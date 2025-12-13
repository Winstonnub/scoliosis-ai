import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <UserButton />
        </div>

        <p className="text-sm text-muted-foreground">
          If you can see this, Clerk route protection is working.
        </p>
      </div>
    </div>
  );
}
