export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const scans = await prisma.scan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>

          <Button asChild>
            <Link href="/dashboard/new">New Scan</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your scans</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {scans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scans yet.</p>
            ) : (
              scans.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{s.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.createdAt.toISOString()}
                    </p>
                  </div>

                  <Button variant="outline" asChild>
                    <Link href={`/scan/${s.id}`}>View</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}