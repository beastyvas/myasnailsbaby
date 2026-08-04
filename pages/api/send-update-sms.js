import { createServerClient } from '@supabase/ssr';
import { sendSms } from '@/utils/sms';
import * as M from "@/utils/messages";

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
  const message = M.movedByMya({ name, oldDate, oldTime, newDate, newTime });

  const ok = await sendSms(phone, message);
  if (!ok) return res.status(500).json({ error: 'Failed to send SMS' });

  console.log(`✅ Update SMS sent to ${phone}`);
  return res.status(200).json({ success: true });
}