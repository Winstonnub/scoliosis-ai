export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { s3Key } = await req.json();
  if (!s3Key) return new NextResponse("Missing s3Key", { status: 400 });

const scan = await prisma.scan.create({
  data: { userId, originalImageUrl: s3Key, status: "UPLOADED" },
});

  return NextResponse.json({ scanId: scan.id });
}