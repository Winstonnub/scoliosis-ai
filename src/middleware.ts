import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)", // protect everything under /dashboard
]);

const isApiRoute = createRouteMatcher([
  "/api(.*)", // match all API routes
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Allowlist check for authenticated users (defense-in-depth)
  const { userId } = await auth();
  if (userId) {
    const allowlist = process.env.ALLOWED_USER_IDS?.split(",").map((id) => id.trim()) || [];
    
    // If allowlist is configured and user is not in it, block access
    if (allowlist.length > 0 && !allowlist.includes(userId)) {
      // Block API routes and dashboard
      if (isApiRoute(req) || isProtectedRoute(req)) {
        return NextResponse.json(
          { error: "Access denied. You are not authorized to use this system." },
          { status: 403 }
        );
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};


// If someone visits /dashboard (or anything under it) and isn’t signed in → they get redirected to /sign-in.