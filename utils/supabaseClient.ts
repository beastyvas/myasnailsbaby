import { createBrowserClient } from '@supabase/ssr';

/**
 * The browser Supabase client.
 *
 * This used `createClient` from @supabase/supabase-js, which persists the
 * session to **localStorage**. Nothing else in the app ever wrote an auth
 * cookie — `createServerClient` appears only in middleware.ts and
 * utils/requireAdmin.js, and both of those only read one.
 *
 * So the server had nothing to read, and every authenticated API route
 * answered 401 while the dashboard plainly showed someone signed in. That
 * included send-update-sms, which is why a client was never told when their
 * appointment got moved.
 *
 * createBrowserClient stores the session in cookies instead, which is what
 * the middleware and the admin check already expect. The export shape is
 * unchanged, so every `import { supabase }` keeps working.
 *
 * Sessions held in localStorage do not carry over — everyone signs in once
 * more after this ships, and then it sticks.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
