import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Record what an appointment actually earned, or mark it a no-show.
 *
 * The site only ever sees the $20 deposit — the rest is settled at the
 * chair, in whatever form. Until Mya enters the real total, the books can
 * only honestly count the deposit, so this is the one step that turns the
 * Business tab from a deposit tracker into a P&L.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  const { booking_id, total_dollars, no_show } = req.body ?? {};
  if (!booking_id) return res.status(400).json({ error: "Missing booking_id" });

  if (no_show === true) {
    const { error } = await supabase
      .from("bookings")
      .update({ no_show: true, completed_at: new Date().toISOString(), collected_cents: null })
      .eq("id", booking_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, no_show: true });
  }

  const amount = Number(String(total_dollars ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "Enter what you collected." });
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      collected_cents: Math.round(amount * 100),
      completed_at: new Date().toISOString(),
      no_show: false,
    })
    .eq("id", booking_id);

  if (error) {
    console.error("Complete booking failed:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
