import { isAdmin } from "@/utils/requireAdmin";
import { normalizePhone, sendSms } from '@/utils/sms';
import * as M from "@/utils/messages";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ✅ AUTHENTICATION CHECK
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: 'Unauthorized — must be logged in' });
  }

  try {
    const { name, phone, date, start_time } = req.body;

    // ✅ INPUT VALIDATION
    if (!name || typeof name !== 'string' || name.length > 100) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    // Accepts anything normalizePhone can read — numbers are stored as the
    // client typed them, so an exact 10-digit check rejected perfectly good
    // ones like "+1 702 555 0134".
    if (!normalizePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    if (!start_time || typeof start_time !== 'string') {
      return res.status(400).json({ error: 'Invalid time' });
    }

    const ok = await sendSms(
      phone,
      M.cancelledByMya({ name, date, startTime: start_time })
    );
    if (!ok) return res.status(500).json({ error: "Couldn't send the cancellation text" });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel SMS error:", err.message);
    res.status(500).json({ error: err.message });
  }
}