// middleware.ts (at project root)
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  // always create a mutable response
  const res = NextResponse.next();

  // Edge-safe Supabase client.
  //
  // getAll/setAll rather than get/set/remove: Supabase splits a large auth
  // token across numbered cookies (sb-<ref>-auth-token.0, .1) and the
  // single-cookie get(name) API cannot discover those chunks, so it would
  // see no session and bounce a signed-in Mya to /login. The old API is also
  // deprecated in @supabase/ssr 0.7.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          // A refreshed token is written back onto the response so the
          // session keeps rolling rather than expiring mid-visit.
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, { ...options, path: options?.path ?? '/' });
          });
        },
      },
    }
  );

  // getUser validates the token against the auth server; getSession only
  // decodes whatever the cookie claims, so a forged one would pass.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = req.nextUrl;
  const isProtected = url.pathname.startsWith('/dashboard');

  // Debug headers to verify behavior in the Network panel
  res.headers.set('x-mw', 'hit');              // proves middleware ran
  res.headers.set('x-mw-session', user ? '1' : '0'); // what middleware thinks

  if (isProtected && !user) {
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
