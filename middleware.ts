// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // only protect dashboard
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  // Supabase cookies if using helpers; if not present, treat as unauth
  const hasSession =
    req.cookies.has("sb-access-token") ||
    req.cookies.has("supabase-auth-token") ||
    req.cookies.has("supabase-auth-token.expires"); // some setups

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
