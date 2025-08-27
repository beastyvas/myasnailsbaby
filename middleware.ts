// middleware.ts at project root
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // Create a response we can mutate (cookies, etc.)
  const res = NextResponse.next();

  // Supabase helper must receive both req & res, so it can refresh the session cookie
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl;
  const isProtected = url.pathname.startsWith('/dashboard');

  if (isProtected && !session) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', url.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Optional: debugging header to prove middleware ran
  res.headers.set('x-mw', 'hit');
  return res;
}

// Only run on dashboard routes
export const config = {
  matcher: ['/dashboard/:path*'],
};
