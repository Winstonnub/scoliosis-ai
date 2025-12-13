export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const scanId = url.searchParams.get("scanId");
  if (!scanId) return new NextResponse("Missing scanId", { status: 400 });

  // Ensure the scan belongs to this user
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, userId },
    select: { originalImageUrl: true }, // this stores s3Key
  });

  if (!scan?.originalImageUrl) return new NextResponse("Scan not found or missing image", { status: 404 });

  const key = scan.originalImageUrl;

  const cmd = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
  });

  // Presigned GET URL valid for 60s
  const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });

  return NextResponse.json({ signedUrl });
}