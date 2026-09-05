// Client money. The headline case is the unpaid-deposit bug: Mya adds
// appointments herself and those were being discounted $20 she never took.
import {
  bookingCharge, summarizeClient, shortAgo, daysBetweenDates,
} from "../utils/clientSummary.js";

import { suite } from "./helpers/harness.mjs";

const h = suite("clientSummary");
const ok = (c, w) => h.ok(w, c);
const eq = (g, w, what) => h.eq(what, g, w);

const TODAY = "2026-09-03";

const paid = bookingCharge({ quoted_cents: 9500, paid: true });
eq(paid.dueCents, 7500, "paid booking: $95 less the $20 deposit -> $75");
const unpaid = bookingCharge({ quoted_cents: 9500, paid: false });
eq(unpaid.dueCents, 9500, "UNPAID booking: full $95 due, no phantom $20 off");
ok(unpaid.dueCents - paid.dueCents === 2000, "the unpaid one is exactly $20 more — the money that was being lost");
eq(unpaid.depositPaid, false, "reports deposit not paid");

eq(bookingCharge({ quoted_cents: 9500, paid: true, credit_applied_cents: 2000 }).dueCents, 5500, "$20 credit -> $55");
eq(bookingCharge({ quoted_cents: 9500, paid: true, discount_percent: 20 }).dueCents, 5600, "20% off -> $56");
eq(bookingCharge({ quoted_cents: 9500, paid: false, discount_percent: 20 }).dueCents, 7600, "20% off, unpaid -> $76");

for (const q of [null, undefined, 0, "abc"]) {
  const r = bookingCharge({ quoted_cents: q, paid: true });
  ok(r.priced === false, `quoted_cents=${JSON.stringify(q)} -> priced:false, UI shows nothing not $0`);
}

const history = [
  { date: "2026-08-01", quoted_cents: 9500, paid: true },              // attended, priced
  { date: "2026-08-20", quoted_cents: 5500, paid: true },              // attended, priced
  { date: "2026-06-01", quoted_cents: null, paid: true },              // attended, unpriced (old)
  { date: "2026-07-04", quoted_cents: 9500, paid: true, no_show: true }, // no-show
  { date: "2026-09-20", quoted_cents: 7500, paid: true },              // upcoming
  { date: "2026-09-10", quoted_cents: 4500, paid: false },             // upcoming, sooner, UNPAID
];
const s = summarizeClient(history, TODAY);
eq(s.visits, 3, "visits counts attended only (no-show and upcoming excluded)");
eq(s.lifetimeCents, 15000, "lifetime = $95 + $55, the unpriced one contributes nothing");
eq(s.pricedVisits, 2, "two priced visits");
eq(s.unpricedCount, 1, "one older visit has no price recorded");
eq(s.avgTicketCents, 7500, "average over PRICED visits ($150/2), not dragged down by the unpriced one");
eq(s.lastVisit, "2026-08-20", "last visit is the most recent attended");
eq(s.noShows, 1, "no-show counted separately");
eq(s.nextAppointment.date, "2026-09-10", "next appointment is the SOONEST upcoming, not the first in the array");
eq(s.upcomingCount, 2, "two upcoming");

const next = bookingCharge(s.nextAppointment);
eq(next.dueCents, 4500, "no deposit taken -> full $45 due");
eq(next.depositPaid, false, "and she can see the deposit wasn't paid");

const old = summarizeClient([{ date: "2026-01-01", quoted_cents: null, paid: true }], TODAY);
eq(old.lifetimeCents, 0, "lifetime is 0…");
eq(old.unpricedCount, 1, "…but flagged as unpriced, so the UI won't claim they spent $0");
eq(old.avgTicketCents, 0, "no average from zero priced visits (no divide-by-zero)");

const none = summarizeClient([], TODAY);
eq(none.visits, 0, "no bookings");
eq(none.nextAppointment, null, "no next appointment");
ok(summarizeClient(null, TODAY).visits === 0, "null input doesn't throw");

eq(daysBetweenDates("2026-08-20", TODAY), 14, "14 days");
eq(shortAgo(0), "today", "today");
eq(shortAgo(1), "yesterday", "yesterday");
eq(shortAgo(5), "5d ago", "days");
eq(shortAgo(21), "3w ago", "weeks");
eq(shortAgo(90), "3mo ago", "months");
eq(shortAgo(null), "never", "never seen");

h.done();
