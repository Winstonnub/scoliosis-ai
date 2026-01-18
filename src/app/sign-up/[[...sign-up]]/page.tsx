import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">Sign Up Disabled</h1>
        <p className="text-muted-foreground">
          Public signup is currently disabled. Access is by invitation only.
          Please contact the administrator if you need access to this system.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
