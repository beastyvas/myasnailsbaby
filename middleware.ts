// middleware.ts (at project root)
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  // always create a mutable response
  const res = NextResponse.next();

  // Edge-safe Supabase client with explicit cookie adapter
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set(name, value, { ...options, path: '/' });
        },
        remove(name, options) {
          res.cookies.delete({
            name,
            path: options?.path ?? '/',
          } as any);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl;
  const isProtected = url.pathname.startsWith('/dashboard');

  // Debug headers to verify behavior in the Network panel
  res.headers.set('x-mw', 'hit');              // proves middleware ran
  res.headers.set('x-mw-session', session ? '1' : '0'); // what middleware thinks

  if (isProtected && !session) {
    const loginUrl = url.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectedFrom', url.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

// Only run on dashboard routes
export const config = {
  matcher: ['/dashboard/:path*'],
};
