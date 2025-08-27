import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSupabaseSession(req: NextRequest) {
  return (
    req.cookies.has("sb-access-token") ||
    req.cookies.has("sb-refresh-token") ||
    req.cookies.has("supabase-auth-token") ||
    req.cookies.has("supabase-auth-token.expires")
  );
}

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const isDash = p === "/dashboard" || p.startsWith("/dashboard/");
  if (!isDash) return NextResponse.next();

  if (!hasSupabaseSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", p);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard", "/dashboard/:path*"] };
