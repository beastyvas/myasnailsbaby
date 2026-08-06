import { createClient } from "@supabase/supabase-js";
import { checkQuota, normalizePhone, sendSms } from "@/utils/sms";
import { GROWTH_ENABLED } from "@/utils/features";
import { hoursSince, hoursUntil, todayVegas, vegasParts } from "@/utils/time";
import * as M from "@/utils/messages";
import {
  dueFor24hReminder,
  dueForDayOf,
  dueForRebook,
  dueForReview,
  isQuietHour,
} from "@/utils/windows";

// SERVICE ROLE: this runs with no user session — a cron has no cookies.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SETTINGS_ID = "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9";

/** How far back to look for visits worth following up on. */
const LOOKBACK_DAYS = 120;

/**
 * The hourly job. Everything automatic the site does to earn money lives
 * here, so there's one place to reason about what a client receives.
 *
 *   · 24h reminder        — appointments 6–26h out
 *   · day-of reminder     — appointments 0–6h out
 *   · review request      — 2–24h after the appointment ended
 *   · rebooking nudge     — at the fill interval, before they drift
 *   · checkout recovery   — 30 min after a checkout was started and dropped
 *
 * Those windows are wide on purpose. This job is scheduled hourly and does
 * not run hourly — GitHub throttles free-tier cron to every 2–4 hours — so
 * the original two-hour windows were being stepped straight over, skipping
 * the text with no error. See utils/windows.js for the measured gaps.
 *
 * Every message is idempotent: the appointment ones through sms_log, and
 * checkout recovery through its own recovered_at stamp (there's no booking
 * row to key against). Running twice in an hour, or re-running after a
 * failure, can't double-text anyone — which is exactly what makes the wide
 * windows safe rather than spammy.
 *
 * Authenticated by CRON_SECRET rather than a login session. The previous
 * reminder endpoint required a signed-in dashboard session, which meant no
 * scheduler could ever call it — reminders only went out if Mya opened the
 * page and triggered them by hand.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the automation engine.");
    return res.status(500).json({ error: "CRON_SECRET is not configured" });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = Date.now();
  const today = todayVegas();
  const since = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

  // Nothing automated goes out overnight. Computed once per run from Vegas
  // local time, so it follows DST without a hardcoded offset.
  const vegasHour = Number(vegasParts(new Date(now)).time.slice(0, 2));
  const quiet = isQuietHour(vegasHour);

  const [{ data: bookings, error }, { data: settings }, { data: optOuts }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, name, phone, service, date, start_time, end_time, paid, confirmed, refunded, no_show")
      .gte("date", since),
    supabase
      .from("settings")
      .select("reviews_enabled, rebook_enabled, rebook_after_weeks")
      .eq("id", SETTINGS_ID)
      .single(),
    supabase.from("marketing_optouts").select("phone"),
  ]);

  if (error) {
    console.error("Engine: couldn't load bookings:", error.message);
    return res.status(500).json({ error: error.message });
  }

  // A missing settings row shouldn't silence the automations.
  const reviewsOn = settings?.reviews_enabled ?? true;
  const rebookOn = settings?.rebook_enabled ?? true;
  const rebookWeeks = settings?.rebook_after_weeks ?? 3;
  const optedOut = new Set((optOuts || []).map((o) => o.phone));

  // A booking only counts as real if it was paid for and not refunded away.
  const live = (bookings || []).filter((b) => b.confirmed && !b.refunded && b.phone && b.date);

  const counts = {
    reminder_24h: 0,
    reminder_day_of: 0,
    review_request: 0,
    rebook_nudge: 0,
    checkout_recovery: 0,
  };
  const failures = [];
  /** Surfaced in the response so a run of all zeroes overnight is
   *  distinguishable from a run where nothing was due. */
  let skippedQuiet = 0;

  /** Send once, ever, for this (booking, kind). Claims the slot before
   *  sending: a duplicate row is harmless, a duplicate text is not. */
  async function sendOnce(booking, kind, message, opts = {}) {
    // Bail BEFORE claiming. Taking the sms_log row and then not sending
    // would mark it delivered forever — the client would simply never be
    // reminded. Skipping without a claim means the next run after 8am picks
    // it up, which the widened windows are what make possible.
    if (quiet) {
      skippedQuiet++;
      return;
    }

    const { error: claimErr } = await supabase
      .from("sms_log")
      .insert({ booking_id: booking.id, kind });

    // 23505 = unique violation: another run already has this one.
    if (claimErr) {
      if (claimErr.code !== "23505") {
        console.error(`Engine: sms_log insert failed (${kind}):`, claimErr.message);
      }
      return;
    }

    if (await sendSms(booking.phone, message, opts)) {
      counts[kind]++;
    } else {
      // Release the claim so the next run retries rather than swallowing it.
      await supabase.from("sms_log").delete().eq("booking_id", booking.id).eq("kind", kind);
      failures.push({ booking: booking.id, kind });
    }
  }

  // ── upcoming: the two reminders ───────────────────────────────────────
  for (const b of live) {
    if (b.no_show) continue;
    const until = hoursUntil(b.date, b.start_time, now);
    if (until === null || until <= 0) continue;

    if (dueFor24hReminder(until)) {
      await sendOnce(
        b,
        "reminder_24h",
        M.reminder24h({ name: b.name, date: b.date, startTime: b.start_time })
      );
    } else if (dueForDayOf(until)) {
      await sendOnce(
        b,
        "reminder_day_of",
        M.reminderDayOf({ name: b.name, startTime: b.start_time })
      );
    }
  }

  // ── just finished: the review ask ─────────────────────────────────────
  // Reviews are the single biggest lever on where the studio ranks in
  // Google's map pack, and the two hours after someone leaves loving their
  // nails is the moment they'll actually do it. No link on purpose: the ask
  // tells them what to search, which works before the Business Profile has
  // a short link and doesn't trip Textbelt's link filter.
  if (reviewsOn) {
    for (const b of live) {
      if (b.no_show) continue;
      const sinceEnd = hoursSince(b.date, b.end_time || b.start_time, now);
      if (!dueForReview(sinceEnd)) continue;

      await sendOnce(
        b,
        "review_request",
        M.reviewRequest({ name: b.name })
      );
    }
  }

  // ── a few weeks on: the rebooking nudge ───────────────────────────────
  // Nails grow out on a schedule, so the nudge is timed to the fill rather
  // than to a client going quiet. It lands weeks before the reactivation
  // campaign would — catching someone while they still love their set and
  // will rebook at full price, instead of winning them back at a discount.
  // GROWTH_ENABLED sits outside the settings toggle on purpose: while the
  // switch is off, nothing in the dashboard can turn this back on by accident.
  if (GROWTH_ENABLED && rebookOn) {
    const hasUpcoming = new Set(
      live.filter((b) => b.date >= today && !b.no_show).map((b) => b.phone)
    );

    // Nudge off their most recent visit only — an older one would double-text.
    const lastVisit = new Map();
    for (const b of live) {
      if (b.date > today || b.no_show) continue;
      const prev = lastVisit.get(b.phone);
      if (!prev || b.date > prev.date) lastVisit.set(b.phone, b);
    }

    const dueDays = rebookWeeks * 7;
    for (const b of lastVisit.values()) {
      if (hasUpcoming.has(b.phone)) continue; // already coming back
      // Opt-outs are stored normalized; booking phones are stored as typed.
      if (optedOut.has(normalizePhone(b.phone))) continue;

      const sinceVisit = hoursSince(b.date, b.start_time, now) / 24;
      // Multi-day window; sms_log stops repeats, so the only thing a wider
      // window changes is whether a scheduler outage loses the nudge.
      if (!dueForRebook(sinceVisit, dueDays)) continue;

      await sendOnce(
        b,
        "rebook_nudge",
        M.rebookNudge({ name: b.name, weeks: rebookWeeks }),
        // Promotional, unlike the reminders — replies must reach
        // /api/sms-reply so a STOP is honored without Mya reading it.
        { listenForReplies: true }
      );
    }
  }

  // ── abandoned checkout: one nudge, then let it go ─────────────────────
  // Someone who picked a time and stalled at the card form is the most
  // recoverable person in the funnel — they'd already decided. One text,
  // half an hour later, while the intent is still warm. Never a second.
  const recoverCutoffNew = new Date(now - 30 * 60_000).toISOString();
  const recoverCutoffOld = new Date(now - 12 * 3_600_000).toISOString();

  const { data: abandoned, error: pendingErr } = await supabase
    .from("pending_checkouts")
    .select("id, name, phone, service, date, start_time")
    .eq("completed", false)
    .is("recovered_at", null)
    .lt("created_at", recoverCutoffNew)
    .gt("created_at", recoverCutoffOld);

  if (pendingErr) {
    console.error("Engine: couldn't load pending checkouts:", pendingErr.message);
  } else {
    // Someone who abandoned one checkout and booked a different slot later
    // shouldn't be chased about the one they dropped.
    const bookedPhones = new Set(live.map((b) => normalizePhone(b.phone)));

    for (const p of abandoned || []) {
      // Same rule as sendOnce, and same reason to check before claiming: the
      // recovered_at stamp is this path's idempotency guard, so setting it
      // without sending would lose the nudge for good. The 30min–12h window
      // is wide enough that a morning run still catches an overnight drop.
      if (quiet) { skippedQuiet++; continue; }

      const phone = normalizePhone(p.phone);
      if (!phone || optedOut.has(phone) || bookedPhones.has(phone)) continue;

      // Claim it first — a stalled send must not leave the row eligible for
      // a second run to pick up and text again.
      const { error: claimErr } = await supabase
        .from("pending_checkouts")
        .update({ recovered_at: new Date().toISOString() })
        .eq("id", p.id)
        .is("recovered_at", null);
      if (claimErr) continue;

      const sent = await sendSms(
        p.phone,
        M.checkoutRecovery({ name: p.name, date: p.date, startTime: p.start_time }),
        { listenForReplies: true }
      );

      if (sent) counts.checkout_recovery++;
      else {
        await supabase.from("pending_checkouts").update({ recovered_at: null }).eq("id", p.id);
        failures.push({ pending: p.id, kind: "checkout_recovery" });
      }
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Engine: sent ${total}`, counts, quiet ? `(quiet hours, held ${skippedQuiet})` : "");

  // Asked once per run rather than scraped off a send, because most runs send
  // nothing — and a quiet run is exactly when advance warning is useful.
  const creditsLeft = await checkQuota();

  // Record the run. Bookkeeping must never fail a run that already sent
  // texts — the messages are gone, and erroring now would only cause a
  // pointless retry. supabase-js resolves with { error } rather than
  // throwing, so this is checked, not caught; the try is only for a genuine
  // network throw underneath.
  try {
    const { error: runErr } = await supabase.from("automation_runs").insert({
      sent: total,
      counts,
      failures: failures.length,
      credits_left: creditsLeft,
      quiet_hours: quiet,
      held: skippedQuiet,
    });
    if (runErr) {
      // Most likely cause: the migration hasn't been run yet. Say so plainly
      // rather than leaving a bare Postgres message in the log.
      console.error(
        `Engine: couldn't record the run (${runErr.message}) — ` +
          "has supabase/migrations/add_automation_runs.sql been run?"
      );
    }
  } catch (err) {
    console.error("Engine: couldn't record the run:", err?.message || err);
  }

  return res.status(200).json({
    ok: true,
    sent: total,
    counts,
    failures,
    checked: live.length,
    // Without these, an overnight run of all zeroes is indistinguishable
    // from a broken one — which is the exact ambiguity that hid the
    // missing sms_log table for a day.
    quietHours: quiet,
    heldForMorning: skippedQuiet,
    // Read by the workflow, which fails the run when this gets low — a
    // green tick while texts silently stop is the failure mode being closed.
    creditsLeft,
  });
}
