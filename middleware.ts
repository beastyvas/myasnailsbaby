// /middleware.ts  (ROOT, not in /pages)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /dashboard
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  // Supabase sets these cookies on sign in
  const hasSession =
    req.cookies.has("sb-access-token") || req.cookies.has("supabase-auth-token");

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
