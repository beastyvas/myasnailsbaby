import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";
import { overallHealth } from "@/utils/health";
import { todayVegas, vegasInstant } from "@/utils/time";

/**
 * What the automations have been doing, for Mya's dashboard.
 *
 * SERVICE ROLE, behind isAdmin. Both sms_log and automation_runs have RLS on
 * with no policy, so the browser's anon key cannot read them — deliberately,
 * since one is a list of who was texted when and the other is operational
 * history. Loosening that to save an API route would be the wrong trade, so
 * this follows the same shape as pages/api/reactivation.js.
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Mya's words, not the code's. She never sees a `kind`. */
const LABELS = {
  reminder_24h: "Reminder sent",
  reminder_day_of: "Day-of reminder",
  review_request: "Asked for a review",
  rebook_nudge: "Nudged to rebook",
  checkout_recovery: "Chased an unfinished booking",
};

export default async function handler(req, res) {
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  try {
    const startOfToday = vegasInstant(todayVegas()).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [runRes, weekRes, recentRes] = await Promise.all([
      supabase
        .from("automation_runs")
        .select("ran_at, sent, counts, failures, credits_left, quiet_hours, held")
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // One query for the week; today is counted from it client-side here
      // rather than with a second round trip.
      supabase.from("sms_log").select("kind, sent_at").gte("sent_at", weekAgo),
      supabase
        .from("sms_log")
        .select("kind, sent_at, bookings(name)")
        .order("sent_at", { ascending: false })
        .limit(10),
    ]);

    // A missing automation_runs table (migration not run yet) must not blank
    // the whole panel — the sms_log half is still worth showing.
    const lastRun = runRes.error ? null : runRes.data;
    if (runRes.error) {
      console.warn("automations-status: no run history —", runRes.error.message);
    }

    const week = weekRes.data || [];
    const sentThisWeek = week.length;
    const sentToday = week.filter((r) => r.sent_at >= startOfToday).length;

    const recent = (recentRes.data || []).map((r) => ({
      label: LABELS[r.kind] || r.kind,
      name: r.bookings?.name || "",
      sentAt: r.sent_at,
    }));

    return res.status(200).json({
      ok: true,
      sentToday,
      sentThisWeek,
      recent,
      lastRunAt: lastRun?.ran_at ?? null,
      creditsLeft: lastRun?.credits_left ?? null,
      failures: lastRun?.failures ?? 0,
      // Computed server-side so the dashboard and any future caller can't
      // disagree about what "fine" means.
      health: overallHealth({
        lastRunAt: lastRun?.ran_at ?? null,
        creditsLeft: lastRun?.credits_left ?? null,
        failures: lastRun?.failures ?? 0,
      }),
    });
  } catch (err) {
    console.error("automations-status failed:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to load status" });
  }
}
