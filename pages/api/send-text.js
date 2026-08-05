import { isAdmin } from "@/utils/requireAdmin";
import { sendSms } from '@/utils/sms';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // ✅ AUTHENTICATION CHECK - prevents unauthorized SMS sending
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: 'Unauthorized — must be logged in' });
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

  const ok = await sendSms(
    process.env.MYA_PHONE_NUMBER,
    `📅 New Booking: ${name} on ${date} at ${start_time}`
  );
  if (!ok) return res.status(500).json({ success: false, error: "Couldn't send the alert text" });

  res.status(200).json({ success: true });
}