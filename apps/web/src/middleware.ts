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
  ],
};
