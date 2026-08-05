import { createServerClient } from "@supabase/ssr";

/**
 * True when the request carries a signed-in dashboard session.
 *
 * Two things here are load-bearing:
 *
 * `getAll`/`setAll` rather than `get`/`set`/`remove`. Supabase splits a large
 * auth token across numbered cookies — `sb-<ref>-auth-token.0`, `.1` — and the
 * single-cookie `get(name)` API can't discover those chunks, so it returned
 * nothing and every authenticated route 401'd while Mya was plainly logged in.
 * `getAll` hands the library every cookie and lets it reassemble them. The
 * old API is also deprecated in @supabase/ssr 0.7.
 *
 * `getUser()` rather than `getSession()`. getSession decodes whatever is in
 * the cookie without checking it, so a forged one would pass; getUser
 * validates the token against the auth server. For the check standing between
 * the public internet and sending texts on Mya's account, that's the one to
 * use.
 */
export async function isAdmin(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          // Supabase may hand back a refreshed token. Persisting it keeps the
          // session alive; failing to is harmless, so this never throws.
          try {
            const existing = res.getHeader("Set-Cookie");
            const prior = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
            const next = cookiesToSet.map(({ name, value, options }) => {
              const bits = [`${name}=${value}`, `Path=${options?.path ?? "/"}`];
              if (options?.maxAge != null) bits.push(`Max-Age=${options.maxAge}`);
              if (options?.sameSite) bits.push(`SameSite=${options.sameSite}`);
              if (options?.httpOnly) bits.push("HttpOnly");
              if (options?.secure) bits.push("Secure");
              return bits.join("; ");
            });
            res.setHeader("Set-Cookie", [...prior, ...next]);
          } catch {
            /* headers already sent — the auth check itself still stands */
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // Distinguishable in the logs from "no cookie at all", which is the
    // ordinary logged-out case and not worth shouting about.
    if (Object.keys(req.cookies || {}).length > 0) {
      console.warn("Admin check failed despite cookies present:", error.message);
    }
    return false;
  }

  return !!user;
}
