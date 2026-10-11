import { isAdmin } from "@/utils/requireAdmin";
import { sendSms } from "@/utils/sms";
import * as M from "@/utils/messages";

/**
 * Texts a client their appointment after Mya edits it in the dashboard.
 *
 * The dashboard decides WHETHER to send (only when something the client cares
 * about changed, on an upcoming appointment, with the box ticked); this route
 * just builds the message from the booking as saved and sends it.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  const b = req.body || {};

  if (!b.phone || typeof b.phone !== "string" || b.phone.replace(/\D/g, "").length < 10) {
    return res.status(400).json({ error: "Invalid phone number" });
  }
  if (!b.name || typeof b.name !== "string" || b.name.length > 100) {
    return res.status(400).json({ error: "Invalid name" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) {
    return res.status(400).json({ error: "Invalid date format" });
  }
  if (!/^\d{1,2}:\d{2}/.test(b.start_time || "")) {
    return res.status(400).json({ error: "Invalid time" });
  }

  const message = M.updatedByMya({
    name: b.name,
    date: b.date,
    startTime: b.start_time,
    service: b.service,
    length: b.length,
    artLevel: b.art_level,
    soakoff: b.soakoff,
    pedicure: b.pedicure,
    pedicureType: b.pedicure_type,
    pediFrench: b.pedi_french === "yes",
  });

  const ok = await sendSms(b.phone, message);
  if (!ok) return res.status(500).json({ error: "Failed to send SMS" });

  return res.status(200).json({ success: true });
}
