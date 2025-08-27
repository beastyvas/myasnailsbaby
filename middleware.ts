// /middleware.ts  — DIAGNOSTIC
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // add a visible header on EVERY request so we can confirm runtime
  const res = NextResponse.next();
  res.headers.set("x-mw", "hit");

  // force redirect ONLY for /dashboard* so we can check matching
  if (req.nextUrl.pathname === "/dashboard" || req.nextUrl.pathname.startsWith("/dashboard/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

// Match EVERYTHING (temporarily)
export const config = { matcher: ["/:path*"] };
