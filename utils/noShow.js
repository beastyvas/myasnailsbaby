/** The no-show fee: 50% of the remaining service — the service price (after
 *  any discount) minus the $20 deposit.
 *
 *  It used to be a flat $25. Everyone who booked before NOSHOW_50_FROM
 *  agreed to $25 at checkout, and a saved card may only be charged what the
 *  client authorized — so those bookings stay at $25. Anything booked after
 *  it agreed to the 50% wording.
 *
 *  Pure and browser-safe: the dashboard and the charge API both use it, so
 *  the amount Mya confirms is the amount that's charged.
 */
import { DEPOSIT_CENTS } from "./pricing.js";
import { chairTotal } from "./credits.js";

/** When the 50% wording went live at checkout (a little after the deploy, so
 *  nobody who saw the old $25 wording is ever charged more). */
export const NOSHOW_50_FROM = "2026-11-20T20:00:00Z";
export const OLD_NOSHOW_FEE_CENTS = 2500;

/** True when the booking was made under the old flat-$25 terms. A booking
 *  with no created_at is treated as old — the lower fee is the safe guess. */
export function onOldTerms(booking = {}) {
  const t = Date.parse(booking.created_at);
  return !Number.isFinite(t) || t < Date.parse(NOSHOW_50_FROM);
}

/**
 * @param booking      the bookings row (quoted_cents, discount_percent, paid, created_at)
 * @param serviceCents optional service price Mya typed in, for a booking with no saved quote
 * @returns {{ cents: number|null, basis: "old-flat"|"half-remaining"|"unpriced" }}
 */
export function noShowFee(booking = {}, serviceCents = null) {
  if (onOldTerms(booking)) return { cents: OLD_NOSHOW_FEE_CENTS, basis: "old-flat" };

  const quoted = Number(booking.quoted_cents);
  const typed = Number(serviceCents);
  const list = Number.isFinite(quoted) && quoted > 0 ? quoted : Number.isFinite(typed) && typed > 0 ? typed : null;
  if (list == null) return { cents: null, basis: "unpriced" };

  const { afterDiscount } = chairTotal({ quotedCents: list, discountPercent: Number(booking.discount_percent) || 0 });
  const remaining = Math.max(0, afterDiscount - DEPOSIT_CENTS);
  // Exact cents, rounded down — never charge a hair over the 50% they agreed to.
  return { cents: Math.floor(remaining / 2), basis: "half-remaining" };
}

/** "$22.50", "$25" — cents shown only when there are any. */
export function feeLabel(cents) {
  if (cents == null || !Number.isFinite(cents)) return "";
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}
