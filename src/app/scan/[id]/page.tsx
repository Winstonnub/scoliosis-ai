import { auth } from "@clerk/nextjs/server"; // get userId
import { prisma } from "@/lib/db"; // Prisma client
import { notFound } from "next/navigation"; // 404 helper
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // UI

export default async function ScanPage({ params }: { params: { id: string } }) {
  const { userId } = await auth(); // current user
  if (!userId) return null;

  const scan = await prisma.scan.findFirst({
    where: { id: params.id, userId }, // security: only allow owner to see it
    include: { detections: true }, // later: show predicted boxes
  });

  if (!scan) return notFound();

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Scan {scan.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Created: {scan.createdAt.toISOString()}
            </p>
            <p className="text-sm">
              Image URL: {scan.originalImageUrl ?? "(none yet)"}
            </p>
            <p className="text-sm">
              Detections: {scan.detections.length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
