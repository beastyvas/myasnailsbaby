// The pedicure french-tips box: priced, carried through checkout, and shown.
import { read, load } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const h = suite("pediFrench");
const ok = (c, w) => h.ok(w, c);

const P = await load("utils/pricing.js");
const base = { pedicure: "yes", pedicureType: "Gel pedicure" };
ok(P.quote(base).total === 5000, "gel pedi alone is $50");
ok(P.quote({ ...base, pediFrench: true }).total === 5500, "with french tips is $55");
ok(P.quote({ pedicure: "no", pediFrench: true }).total === 0, "french tips without a pedicure adds nothing");

const checkout = read("pages/api/create-checkout-session.js");
ok(/pediFrench: bookingMetadata\.pedi_french === "yes"/.test(checkout), "checkout prices the box server-side");
ok(/pedi_french: bookingMetadata\.pedi_french/.test(checkout), "checkout passes it to Stripe metadata");

const hook = read("pages/api/stripe-webhook.js");
ok(/pedi_french: md\.pedi_french/.test(hook), "webhook saves it on the booking");
ok(/pedi_french: "run supabase\/migrations\/add_pedi_french\.sql/.test(hook), "a missing column doesn't lose the booking");

const dash = read("pages/dashboard.js");
ok(/booking\.pedi_french === "yes"/.test(dash), "dashboard card shows it");

const M = await load("utils/messages.js");
ok(M.ownerNewBooking({ name: "A", service: "Gel-X", pedicure: "yes", pediFrench: true, date: "2026-10-22", startTime: "10:00" }).includes("french tips"), "Mya's new-booking text says french tips");

h.done();
