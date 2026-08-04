import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";
import { normalizePhone } from "@/utils/sms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Move a number in or out of promotional texts by hand — for when someone
 * asks Mya in person or over DM rather than replying STOP.
 *
 * Transactional messages (confirmations, reminders, cancellations) are
 * unaffected either way.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  const phone = normalizePhone(req.body?.phone ?? "");
  if (!phone) return res.status(400).json({ error: "Bad phone number" });

  const optOut = req.body?.opted_out !== false;

  const { error } = optOut
    ? await supabase.from("marketing_optouts").upsert({ phone }, { onConflict: "phone" })
    : await supabase.from("marketing_optouts").delete().eq("phone", phone);

  if (error) {
    console.error("Opt-out update failed:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, phone, opted_out: optOut });
}
