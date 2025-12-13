import { auth } from "@clerk/nextjs/server"; // get userId server-side
import { prisma } from "@/lib/db"; // Prisma client
import { redirect } from "next/navigation"; // server redirect

export default async function NewScanPage() {
  const { userId } = await auth(); // current user
  if (!userId) return null; // should not happen due to middleware

  await prisma.scan.create({
    data: {
      userId, // associate scan with this user
      originalImageUrl: null, // later: store S3 URL here
    },
  });

  redirect("/dashboard"); // go back to dashboard to see the new scan
}
