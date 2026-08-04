import { createServerClient } from "@supabase/ssr";

/**
 * True when the request carries a signed-in dashboard session.
 *
 * The same cookie-adapter dance was pasted into every protected handler;
 * having it in one place means a route can't accidentally ship with a
 * subtly different version of the check.
 */
export async function isAdmin(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => {
          res.setHeader(
            "Set-Cookie",
            `${name}=${value}; Path=/; ${options?.httpOnly ? "HttpOnly;" : ""} ${
              options?.secure ? "Secure;" : ""
            }`
          );
        },
        remove: (name) => {
          res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0`);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return !!session;
}
