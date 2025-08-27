// TEMP DIAGNOSTIC MIDDLEWARE
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // add a header on *every* request so we can see if this runs at all
  const res = NextResponse.next();
  res.headers.set("x-mw", "hit");

  // force redirect from /dashboard to /login to prove matching
  if (req.nextUrl.pathname === "/dashboard" || req.nextUrl.pathname.startsWith("/dashboard/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

// match everything so we can see the header on any route
export const config = { matcher: ["/:path*"] };
