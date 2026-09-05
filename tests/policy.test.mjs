// Today's changes: the cancel switch, and the promise the copy makes.
import { read, load } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const R = read;
const h = suite("policy");
const ok = (c, w) => h.ok(w, c);

const feat = await load("utils/features.js");
ok(feat.CLIENT_CANCEL_ENABLED === false, "CLIENT_CANCEL_ENABLED is false");

const api = R("pages/api/cancel-booking.js");
ok(/if \(!CLIENT_CANCEL_ENABLED\)[\s\S]{0,200}status\(403\)/.test(api), "cancel API returns 403 when off");
// Must be the FIRST thing: a bookmark shouldn't get as far as deleting a row.
const iFlag = api.indexOf("CLIENT_CANCEL_ENABLED");
for (const later of ['req.body', 'from("bookings")', '.delete()', "client_credits"]) {
  ok(iFlag > -1 && iFlag < api.indexOf(later), `403 is checked before ${later}`);
}

const idx = R("pages/index.js");
ok(/CLIENT_CANCEL_ENABLED && \(/.test(idx), "footer cancel link is behind the flag");
ok(idx.includes('href="/reschedule"'), "reschedule link is NOT behind the flag — she wants that used");

const page = R("pages/cancel-appointment.js");
ok(/if \(!CLIENT_CANCEL_ENABLED\)/.test(page), "the page itself short-circuits rather than showing a dead form");
ok(/Reschedule instead/.test(page), "and offers rescheduling as the alternative");

// We've now been wrong both ways: promising a refund, then promising a credit
// Mya never agreed to. Neither may reappear in anything a client reads.
const clientFacing = [
  "pages/index.js", "pages/services.jsx", "pages/terms.jsx",
  "pages/api/confirm-payment.js", "utils/seo.js", "pages/cancel-appointment.js",
];
const promisesRefund = /is refundable|will be refunded|refund initiated|deposit is <strong[^>]*>refundable/i;
const promisesCredit = /carries over as credit|credit toward your next|stays on your account|comes off your next appointment/i;
for (const f of clientFacing) {
  const src = R(f);
  ok(!promisesRefund.test(src), `${f}: promises no refund`);
  ok(!promisesCredit.test(src), `${f}: promises no credit`);
}

const checkout = R("pages/api/create-checkout-session.js");
ok(!/cancel_url:\s*`\$\{req\.headers\.origin\}\/cancel`/.test(checkout), "cancel_url no longer points at the non-existent /cancel");
ok(/cancel_url:\s*`\$\{req\.headers\.origin\}\/#booking`/.test(checkout), "it returns them to the booking form");

const dash = R("pages/dashboard.js");
ok(dash.includes("bookingCharge("), "dashboard computes charges via bookingCharge");
ok(!/depositCents: DEPOSIT_CENTS/.test(dash), "no hardcoded deposit deduction left — that was the $20 bug");
ok(dash.includes("summarizeClient("), "client list uses summarizeClient");

// Flipping the constant must actually restore the feature — that is the
// whole premise of parking it behind a flag rather than deleting the code.
//
// Tested against a throwaway copy rather than by rewriting utils/features.js
// in place. A test that edits a source file leaves the repo modified if it
// dies halfway, and this suite is meant to be safe to run at any moment.
const flipped = (await import(
  "data:text/javascript," +
  encodeURIComponent(R("utils/features.js").replace(
    "export const CLIENT_CANCEL_ENABLED = false;",
    "export const CLIENT_CANCEL_ENABLED = true;"
  ))
));
ok(flipped.CLIENT_CANCEL_ENABLED === true, "flipping the constant turns cancelling back on");
ok(flipped.GROWTH_ENABLED === false, "and does not disturb the other flag");

const stillOff = await load("utils/features.js");
ok(stillOff.CLIENT_CANCEL_ENABLED === false, "the real file is untouched and still off");

h.done();
