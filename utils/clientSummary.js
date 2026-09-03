/**
 * What Mya needs to know about a client, and what to charge them.
 *
 * Pure, so the same numbers appear on the Clients tab, the Appointments tab
 * and in the tests. Two views of the same booking disagreeing about money is
 * the failure this exists to prevent.
 *
 * Everything here is an ESTIMATE. `quoted_cents` is priced from what the
 * client picked at booking, and art level is Mya's judgement about the design
 * in front of her — so these figures inform her, they don't bind her. The UI
 * labels them accordingly.
 */

import { DEPOSIT_CENTS } from "./pricing.js";
import { chairTotal } from "./credits.js";

/**
 * What to charge for one booking.
 *
 * THE DEPOSIT ONLY COMES OFF IF IT WAS ACTUALLY PAID. Mya adds appointments
 * herself through the dashboard, and those are unpaid — no deposit was ever
 * taken. The dashboard banner hardcoded a $20 deduction, which quietly
 * understated what she was owed on every one of them.
 *
 * @returns {{ listCents:number, dueCents:number, creditUsed:number,
 *             depositPaid:boolean, priced:boolean }}
 */
export function bookingCharge(booking = {}) {
  const priced = Number.isFinite(Number(booking.quoted_cents)) && Number(booking.quoted_cents) > 0;
  const depositPaid = !!booking.paid;

  const t = chairTotal({
    quotedCents: priced ? Number(booking.quoted_cents) : 0,
    discountPercent: Number(booking.discount_percent) || 0,
    depositCents: depositPaid ? DEPOSIT_CENTS : 0,
    creditCents: Number(booking.credit_applied_cents) || 0,
  });

  return {
    listCents: t.listCents,
    dueCents: t.dueCents,
    creditUsed: t.creditUsed,
    depositPaid,
    // A booking made before quoted_cents existed, or one whose selections
    // couldn't be priced. Callers must show nothing rather than "$0".
    priced,
  };
}

/** YYYY-MM-DD for "today" in Vegas — callers pass todayVegas() in. */
function isPast(dateStr, today) {
  return !!dateStr && dateStr < today;
}

/**
 * Roll a client's bookings into the things worth showing.
 *
 * @param {Array}  bookings  every booking for one phone number
 * @param {string} today     YYYY-MM-DD, Vegas
 */
export function summarizeClient(bookings, today) {
  const rows = Array.isArray(bookings) ? bookings : [];

  // A no-show isn't a visit and its quote was never collected, so it must not
  // inflate either the visit count or the lifetime total.
  const attended = rows.filter((b) => isPast(b.date, today) && !b.no_show && !b.refunded);

  let lifetimeCents = 0;
  let pricedVisits = 0;
  let unpricedCount = 0;
  for (const b of attended) {
    const { listCents, priced } = bookingCharge(b);
    if (priced) {
      lifetimeCents += listCents;
      pricedVisits++;
    } else {
      // Counted, not guessed. quoted_cents only exists on bookings made since
      // early August, so a long-standing client's history is mostly unpriced —
      // reporting the gap beats silently understating what they're worth.
      unpricedCount++;
    }
  }

  const pastSorted = [...attended].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastVisit = pastSorted[0]?.date || null;

  const upcoming = rows
    .filter((b) => b.date && b.date >= today && !b.no_show)
    .sort((a, b) =>
      a.date === b.date
        ? String(a.start_time || "").localeCompare(String(b.start_time || ""))
        : a.date < b.date ? -1 : 1
    );

  return {
    visits: attended.length,
    lastVisit,
    daysSince: lastVisit ? daysBetweenDates(lastVisit, today) : null,
    nextAppointment: upcoming[0] || null,
    upcomingCount: upcoming.length,
    lifetimeCents,
    // Averaged over PRICED visits only — dividing by all of them would drag
    // the average down by every booking that predates price tracking.
    avgTicketCents: pricedVisits > 0 ? Math.round(lifetimeCents / pricedVisits) : 0,
    pricedVisits,
    unpricedCount,
    noShows: rows.filter((b) => b.no_show).length,
    noShowsCharged: rows.filter((b) => b.no_show_charged).length,
    hasCard: rows.some((b) => b.stripe_payment_method_id),
  };
}

/** Whole days between two YYYY-MM-DD dates. Midday anchored so a DST shift
 *  can't round a boundary the wrong way. */
export function daysBetweenDates(from, to) {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** "3w ago" — she wants the gap, not the date. */
export function shortAgo(days) {
  if (days == null) return "never";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}
