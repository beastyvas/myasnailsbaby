import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";
import { normalizePhone, sendSms } from "@/utils/sms";
import {
  DORMANT_AFTER_DAYS,
  WINDOW_DAYS,
  buildClients,
  buildStats,
  clampPercent,
  eligibleFrom,
  newCode,
  reactivationMessage,
} from "@/utils/reactivation";

// SERVICE ROLE: reactivation_sends and marketing_optouts have RLS on with no
// policy, so only this key can read the offer log or the opt-out list.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SETTINGS_ID = "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9";

/** Everything both verbs need: who's lapsed, and the offer % in force. */
async function loadAudience() {
  const [bookings, sends, optOuts, settings] = await Promise.all([
    supabase.from("bookings").select("id, name, phone, instagram, date, paid, refunded"),
    supabase.from("reactivation_sends").select("*"),
    supabase.from("marketing_optouts").select("phone"),
    supabase.from("settings").select("reactivation_percent").eq("id", SETTINGS_ID).single(),
  ]);

  const firstError = bookings.error || sends.error || optOuts.error;
  if (firstError) throw new Error(firstError.message);

  const allBookings = bookings.data || [];
  const allSends = sends.data || [];
  const optedOut = new Set((optOuts.data || []).map((o) => o.phone));
  const clients = buildClients(allBookings, allSends, optedOut, normalizePhone);

  return {
    clients,
    eligible: eligibleFrom(clients),
    stats: buildStats(allSends, new Map(allBookings.map((b) => [b.id, b]))),
    // A missing settings row shouldn't block the campaign — fall back to the
    // default rather than 500 on a fresh database.
    percentOff: clampPercent(settings.data?.reactivation_percent),
  };
}

export default async function handler(req, res) {
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  try {
    if (req.method === "GET") return await preview(res);
    if (req.method === "POST") return await send(req, res);
    return res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error("Reactivation error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

/** GET — who's due and the exact text they'd receive. Nothing is sent. */
async function preview(res) {
  const { clients, eligible, stats, percentOff } = await loadAudience();
  const expiresAt = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString();

  return res.status(200).json({
    ok: true,
    percentOff,
    windowDays: WINDOW_DAYS,
    dormantAfterDays: DORMANT_AFTER_DAYS,
    stats,
    clients,
    recipients: eligible.map((c) => ({
      phone: c.phone,
      name: c.name,
      daysSinceVisit: c.daysSinceVisit,
      visits: c.visits,
    })),
    // a real render of the first recipient's text, not a mockup
    sample: eligible[0]
      ? reactivationMessage({
          name: eligible[0].name,
          daysSinceVisit: eligible[0].daysSinceVisit,
          percentOff,
          expiresAt,
        })
      : null,
  });
}

/** POST — send it. Optional { phones: [...] } narrows to a chosen subset. */
async function send(req, res) {
  const only = Array.isArray(req.body?.phones) ? req.body.phones : null;

  const { eligible, percentOff } = await loadAudience();
  const targets = only ? eligible.filter((c) => only.includes(c.phone)) : eligible;

  if (targets.length === 0) {
    return res.status(400).json({ error: "Nobody's due for a reactivation text right now." });
  }

  const expiresAt = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString();
  let sent = 0;
  const failed = [];

  for (const c of targets) {
    // Internal reference for the row only — never shown to the client.
    const code = newCode();
    const message = reactivationMessage({
      name: c.name,
      daysSinceVisit: c.daysSinceVisit,
      percentOff,
      expiresAt,
    });

    // Record first. An offer that went out but wasn't logged would be
    // honored by nobody, which is worse than one logged twice.
    const { data: row, error: logErr } = await supabase
      .from("reactivation_sends")
      .insert({
        phone: c.phone,
        name: c.name,
        code,
        percent_off: percentOff,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (logErr) {
      // Stop rather than keep texting offers we can't record.
      console.error("Couldn't log reactivation send:", logErr.message);
      return res.status(503).json({
        error: "Saved sends stopped working, so the campaign was halted partway.",
        sent,
        failed,
      });
    }

    // Promotional — replies must reach /api/sms-reply so STOP is honored.
    if (await sendSms(c.phone, message, { listenForReplies: true })) {
      sent++;
    } else {
      failed.push(c.name || c.phone);
      // Undo the promise we couldn't deliver, so it isn't shown as live and
      // doesn't block them from being texted again next time.
      await supabase.from("reactivation_sends").delete().eq("id", row.id);
    }
  }

  return res.status(200).json({ ok: true, sent, failed, percentOff, windowDays: WINDOW_DAYS });
}
