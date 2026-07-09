export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/people/:path*",
    "/events/:path*",
    "/autopilot/:path*",
    "/billing/:path*",
    "/orders/:path*",
    "/profile/:path*",
    "/upgrade/:path*",
    // Bare "/family" only — NOT "/family/:path*", since /family/join/[token]
    // must stay public (mirrors /survey/[token]'s deliberate exclusion).
    "/family",
  ],
};
