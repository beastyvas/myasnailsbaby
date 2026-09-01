/**
 * Client credit — what a cancelled deposit is worth on the next visit.
 *
 * Mya's deposit is non-refundable, but it is not forfeited either: she keeps
 * the money and honours it against a future service. That's the promise the
 * cancellation page now makes, so this is where it has to be computed
 * correctly.
 *
 * THE THING PEOPLE GET WRONG
 *
 * The deposit is applied to the service, not charged on top of it. So a
 * returning client who paid a deposit on the booking they cancelled AND a
 * deposit on the new one has given Mya $40, and $40 comes off:
 *
 *     Gel-X set                 $95
 *     − deposit paid today     −$20
 *     − credit from cancel     −$20
 *                              ────
 *     due at the chair          $55      (normally $75)
 *
 * She is not out of pocket — she banked $20 early and honours it later.
 *
 * Pure and dependency-free so the webhook, the dashboard and the tests all
 * compute the same number. Two places doing this arithmetic separately is how
 * the figure on screen and the figure she says out loud drift apart.
 */

// The one place the reactivation discount is rounded. Imported rather than
// re-derived: duplicating money rounding is how the figure on screen and the
// figure said out loud drift apart.
import { discountedCents } from "./reactivation.js";

/**
 * What the client actually hands over, with everything applied.
 *
 * A booking can carry BOTH a reactivation discount and a credit from a
 * cancelled appointment. Each banner used to subtract only the deposit, so
 * two of them on one booking would each claim the whole reduction and neither
 * would be right. This resolves all of it to a single number.
 *
 * Order matters: the percentage discount comes off the list price first,
 * then money already in Mya's hands (the deposit, then the credit) is
 * subtracted. Applying a percentage after the credit would discount her own
 * money back to the client.
 *
 * @returns {{ listCents:number, afterDiscount:number, creditUsed:number, dueCents:number }}
 */
export function chairTotal({
  quotedCents,
  discountPercent = 0,
  depositCents = 0,
  creditCents = 0,
} = {}) {
  const list = Number(quotedCents) || 0;
  const afterDiscount = discountPercent > 0 ? discountedCents(list, discountPercent) : list;
  const afterDeposit = Math.max(0, afterDiscount - (Number(depositCents) || 0));
  const creditUsed = Math.min(Math.max(0, Number(creditCents) || 0), afterDeposit);
  return {
    listCents: list,
    afterDiscount,
    creditUsed,
    dueCents: afterDeposit - creditUsed,
  };
}

/** Unredeemed credit across a client's ledger rows, in cents. */
export function availableCents(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, r) => {
    const amount = Number(r?.amount_cents) || 0;
    const used = Number(r?.redeemed_cents) || 0;
    // A row can never contribute negatively, whatever the data says.
    return sum + Math.max(0, amount - used);
  }, 0);
}

/**
 * What the client owes at the chair, and how much credit that consumed.
 *
 * @param {object}  o
 * @param {number?} o.quotedCents     the estimate for the service; null when unpriced
 * @param {number}  o.depositCents    what they paid today to hold the slot
 * @param {number}  o.availableCents  unredeemed credit on their account
 * @returns {{ applied: number, dueCents: number|null, remainingCredit: number }}
 */
export function applyCredit({ quotedCents, depositCents = 0, availableCents: avail = 0 } = {}) {
  const credit = Math.max(0, Number(avail) || 0);
  const deposit = Math.max(0, Number(depositCents) || 0);

  // No quote (a legacy booking, or selections that couldn't be priced) means
  // there's no balance to compute. Report the credit as untouched rather than
  // inventing a total — consuming it against an unknown price would spend
  // their money without anyone being able to check the sum.
  if (!quotedCents || !Number.isFinite(Number(quotedCents))) {
    return { applied: 0, dueCents: null, remainingCredit: credit };
  }

  const afterDeposit = Math.max(0, Number(quotedCents) - deposit);

  // Only apply what actually fits. A $35 basic manicure less a $20 deposit
  // leaves $15 of room, so a $20 credit gives up 15 and keeps 5 — it must not
  // hand back change or drive the total negative.
  const applied = Math.min(credit, afterDeposit);

  return {
    applied,
    dueCents: afterDeposit - applied,
    remainingCredit: credit - applied,
  };
}
