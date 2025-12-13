export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { scanId } = await req.json();
  if (!scanId) return new NextResponse("Missing scanId", { status: 400 });

  // 1) Load scan + ownership check (only this user's scan)
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, userId },
    select: { id: true, originalImageUrl: true, status: true },
  });
  if (!scan) return new NextResponse("Scan not found", { status: 404 });

  const key = scan.originalImageUrl; // S3 key
  if (!key) return new NextResponse("Scan has no image key", { status: 400 });

  // 2) Prevent double-runs
  if (scan.status === "RUNNING") {
    return NextResponse.json({ ok: true, status: "RUNNING", message: "Already running" });
  }

  // 3) Mark RUNNING in DB (so UI can show it)
  await prisma.scan.update({
    where: { id: scanId },
    data: { status: "RUNNING" },
  });

  try {
    // 4) Download image bytes from S3
    const obj = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
      })
    );

    const buf = await streamToBuffer(obj.Body);

    // 5) Send bytes to FastAPI as multipart/form-data
    // 5) Send bytes to FastAPI as multipart/form-data
    // Convert Buffer -> Uint8Array so it's a valid BlobPart in strict TS + Node builds
    const bytes = new Uint8Array(buf);

    const form = new FormData();
    const file = new File([bytes], "xray.png", { type: "image/png" });
    form.append("file", file);

    const baseUrl = process.env.INFERENCE_URL ?? "http://localhost:8001";
    const inferRes = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      body: form,
      headers: process.env.INFERENCE_API_KEY
        ? { "x-api-key": process.env.INFERENCE_API_KEY }
        : undefined,
    });
    if (!inferRes.ok) {
      const text = await inferRes.text();
      throw new Error(`Inference service error: ${text}`);
    }

    const result = await inferRes.json();

    // 6) Save detections (delete old ones first to avoid duplicates)
    await prisma.detection.deleteMany({ where: { scanId } });

    for (const d of result.detections as any[]) {
      await prisma.detection.create({
        data: {
          scanId,
          className: d.class_name,
          confidence: d.confidence,
          x1: d.x1,
          y1: d.y1,
          x2: d.x2,
          y2: d.y2,
        },
      });
    }

    // 7) Mark DONE
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "DONE" },
    });

    return NextResponse.json({ ok: true, status: "DONE", count: result.num_detections });
  } catch (err: any) {
    console.error("RUN INFERENCE ERROR:", err);

    // 8) Mark FAILED so we can show a retry button / message
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "FAILED" },
    });

    return new NextResponse(err?.message ?? "Inference server error", { status: 500 });
  }
}