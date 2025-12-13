import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="max-w-xl space-y-6 text-center">
        <h1 className="text-3xl font-bold">Scoliosis AI</h1>
        <p className="text-sm text-muted-foreground">
          Upload an X-ray and get YOLO detections (demo).
        </p>

        <SignedOut>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </SignedOut>

        <SignedIn>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </SignedIn>
      </div>
    </div>
  );
}
