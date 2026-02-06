import { createServerClient } from '@supabase/ssr';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ✅ AUTHENTICATION CHECK
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

  try {
    const { name, phone, date, start_time } = req.body;

    // ✅ INPUT VALIDATION
    if (!name || typeof name !== 'string' || name.length > 100) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length !== 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    if (!start_time || typeof start_time !== 'string') {
      return res.status(400).json({ error: 'Invalid time' });
    }

    // Strip non-digits from phone number
    const cleanedPhone = phone.replace(/\D/g, '');

    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID, 
      process.env.TWILIO_AUTH_TOKEN
    );

    await twilio.messages.create({
      body: `Hey babes! Your nail appointment with Mya on ${date} @ ${start_time} was canceled. Please dm @myasnailsbaby if you believe this was an error!`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: cleanedPhone,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel SMS error:", err.message);
    res.status(500).json({ error: err.message });
  }
}