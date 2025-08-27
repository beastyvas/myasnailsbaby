// /middleware.ts (root)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSupabaseSession(req: NextRequest) {
  // Current cookie names
  if (req.cookies.has("sb-access-token")) return true;
  if (req.cookies.has("sb-refresh-token")) return true;

  // Legacy auth-helpers cookie
  if (req.cookies.has("supabase-auth-token")) return true;

  // Some setups store expiry/token parts separately
  if (req.cookies.has("supabase-auth-token.expires")) return true;

  return false;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname } = url;

  // Respect basePath if set (e.g. /app)
  const base = url.basePath ?? "";
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;

  // Only protect /dashboard + children
  const isDashboard = path === "/dashboard" || path.startsWith("/dashboard/");
  if (!isDashboard) return NextResponse.next();

  const authed = hasSupabaseSession(req);

  if (!authed) {
    const login = url.clone();
    login.pathname = `${base}/login`;
    login.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(login);
  }

  // add a debug header so we can confirm middleware actually ran
  const res = NextResponse.next();
  res.headers.set("x-mw", "hit");
  return res;
}

// include exact and nested routes explicitly
export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
