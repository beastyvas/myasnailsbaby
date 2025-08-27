import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const url = req.nextUrl.clone()
  const isProtected = url.pathname.startsWith("/dashboard")

  if (isProtected && !session) {
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return res
}