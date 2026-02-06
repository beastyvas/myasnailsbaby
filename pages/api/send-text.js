import { createServerClient } from '@supabase/ssr';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // ✅ AUTHENTICATION CHECK - prevents unauthorized SMS sending
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
    return res.status(401).json({ error: 'Unauthorized - must be logged in' });
  }

  // ✅ INPUT VALIDATION - basic checks to prevent malicious data
  const { name, date, start_time } = req.body;

  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Invalid name' });
  }

  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  if (!start_time || typeof start_time !== 'string') {
    return res.status(400).json({ error: 'Invalid time' });
  }

  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID, 
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    await twilio.messages.create({
      body: `📅 New Booking: ${name} on ${date} at ${start_time}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.MYA_PHONE_NUMBER, // ✅ Now uses env variable
    });
  } catch (error) {
    console.error("Twilio error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }

  res.status(200).json({ success: true });
}