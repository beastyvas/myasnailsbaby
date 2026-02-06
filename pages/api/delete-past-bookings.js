import { createServerClient } from '@supabase/ssr';

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  // ✅ AUTHENTICATION CHECK - critical for data deletion
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => {
          res.setHeader('Set-Cookie', `${name}=${value}; Path=/; ${options?.httpOnly ? 'HttpOnly;' : ''} ${options?.secure ? 'Secure;' : ''}`);
        },
        remove: (name) => {
          res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0`);
        }
      }
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized - must be logged in to delete data' });
  }

  const today = new Date().toISOString().split("T")[0]; // e.g. "2025-06-13"

  const { error } = await supabase
    .from("bookings")
    .delete()
    .lt("date", today); // delete where date is before today

  if (error) {
    console.error("Failed to delete past bookings:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true });
}