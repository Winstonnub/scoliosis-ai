import { NextResponse } from "next/server";

export async function POST() {
  return new NextResponse(
    "This route is disabled. Use /api/uploads/presign + /api/scans/create (S3 upload flow).",
    { status: 410 }
  );
}