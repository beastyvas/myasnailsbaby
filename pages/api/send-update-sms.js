import { createServerClient } from '@supabase/ssr';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const { phone, name, oldDate, oldTime, newDate, newTime } = req.body;

  // ✅ INPUT VALIDATION
  if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Invalid name' });
  }

  if (newDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  // Format time for display
  function formatTime(time24) {
    if (!time24) return "";
    const [hourStr, minuteStr = "00"] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr}${suffix}`;
  }

  // Format date for display
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Build message based on what changed
  let message = `Hi ${name}! Your appointment with Mya has been updated:\n\n`;
  
  if (oldDate !== newDate) {
    message += `📅 New Date: ${formatDate(newDate)}\n`;
  }
  
  if (oldTime !== newTime) {
    message += `🕐 New Time: ${formatTime(newTime)}\n`;
  }
  
  message += `\n📍 Address: 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, Nevada\n\nDM @myasnailsbaby if you have any questions! 💖`;

  try {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID, 
      process.env.TWILIO_AUTH_TOKEN
    );

    await twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    console.log(`✅ Update SMS sent to ${phone}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('SMS API error:', error);
    return res.status(500).json({ error: 'Failed to send SMS' });
  }
}