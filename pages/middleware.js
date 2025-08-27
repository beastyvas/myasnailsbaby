// middleware.js
import { NextResponse } from "next/server";

export async function middleware(req) {
  // Read the Supabase auth cookie. If you’re using @supabase/auth-helpers,
  // you can swap this for createMiddlewareClient; for JS-only, a simple check:
  const hasAuthCookie = req.cookies.has("sb-access-token") || req.cookies.has("sb-refresh-token");

  const url = req.nextUrl.clone();
  const isProtected =
    url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/admin");

  if (isProtected && !hasAuthCookie) {
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
