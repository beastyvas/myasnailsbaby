// No-show fee: 50% of the remaining service (service minus the $20 deposit).
// Bookings made under the old flat-$25 terms keep $25 — a saved card may only
// be charged what the client authorized.
import { noShowFee, feeLabel, NOSHOW_50_FROM } from "../utils/noShow.js";
import { read } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const h = suite("noShow");
const ok = (c, w) => h.ok(w, c);
const eq = (g, w, what) => h.eq(what, g, w);

const NEW = "2026-11-21T18:00:00Z";
const OLD = "2026-11-01T18:00:00Z";

eq(noShowFee({ quoted_cents: 7000, created_at: NEW }).cents, 2500, "$70 service: half of $50 remaining = $25");
eq(noShowFee({ quoted_cents: 8500, created_at: NEW }).cents, 3250, "$85 service: half of $65 = $32.50");
eq(noShowFee({ quoted_cents: 10000, discount_percent: 10, created_at: NEW }).cents, 3500, "discount first: $90 - $20 = $70, half = $35");
eq(noShowFee({ quoted_cents: 2000, created_at: NEW }).cents, 0, "deposit covers it: nothing to charge");
eq(noShowFee({ quoted_cents: 4501, created_at: NEW }).cents, 1250, "rounds DOWN to the cent — never over 50%");
eq(noShowFee({ quoted_cents: 9500, created_at: OLD }).cents, 2500, "booked under old terms: flat $25");
eq(noShowFee({ quoted_cents: 9500 }).cents, 2500, "no created_at: the lower, old fee");
eq(noShowFee({ created_at: NEW }).cents, null, "no saved price: unknown, must ask");
eq(noShowFee({ created_at: NEW }, 7000).cents, 2500, "typed price used when none is saved");
eq(noShowFee({ quoted_cents: 7000, created_at: NEW }, 99999).cents, 2500, "a saved quote beats a typed price");
ok(Date.parse(NOSHOW_50_FROM) > Date.parse("2026-11-20T19:00:00Z"), "cut-over is after the change shipped");
eq(feeLabel(3250), "$32.50", "label with cents");
eq(feeLabel(2500), "$25", "label without cents");

// Nothing a client reads may still promise $25.
for (const f of ["pages/index.js", "pages/api/create-checkout-session.js", "pages/terms.jsx", "pages/success.js"]) {
  ok(!/\$25 no-show/i.test(read(f)), `${f}: no "$25 no-show" wording left`);
}
ok(!/NO_SHOW_FEE_CENTS = 2500/.test(read("pages/api/charge-noshow.js")), "charge API no longer hardcodes $25");
ok(/noShowFee\(booking, service_cents\)/.test(read("pages/api/charge-noshow.js")), "charge API computes the fee server-side");

h.done();
