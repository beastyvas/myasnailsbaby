// The move to Pecos: every appointment gets the address for its own date.
import { load } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const h = suite("location");
const ok = (c, w) => h.ok(w, c);

const L = await load("utils/location.js");
const M = await load("utils/messages.js");
const F = await load("utils/features.js");

ok(L.studioFor("2026-10-20") === L.OLD_STUDIO, "10/20 is still Flamingo");
ok(L.studioFor("2026-10-21") === L.NEW_STUDIO, "10/21 is Pecos");
ok(L.studioFor("2027-01-05") === L.NEW_STUDIO, "next year is Pecos");
ok(L.studioFor(undefined) === L.OLD_STUDIO, "no date falls back to the current studio");

const before = M.reminder24h({ name: "Ana", date: "2026-10-15", startTime: "10:00" });
const after = M.reminder24h({ name: "Ana", date: "2026-10-22", startTime: "10:00" });
ok(before.includes("Flamingo") && !before.includes("Pecos"), "reminder before the move says Flamingo");
ok(after.includes("178 N Pecos Rd Suite 1") && after.includes("Henderson, NV 89074") && !after.includes("Flamingo"), "reminder after the move says Pecos, Henderson");
ok(M.bookingConfirmation({ name: "Ana", date: "2026-11-01", startTime: "10:00" }).includes("Pecos"), "confirmation after the move says Pecos");
ok(M.updatedByMya({ name: "Ana", date: "2026-10-25", startTime: "10:00" }).includes("Pecos"), "an edit past the cut-over uses the new date's address");

ok(F.EXTRA_TEXTS_ENABLED === false, "extra automated texts are off");
ok(F.GROWTH_ENABLED === false, "rebooking nudge is off");

{
  const m = M.updatedByMya({ name: "Ana Lopez", date: "2026-10-22", startTime: "14:00", service: "Gel-X", length: "Medium", artLevel: "Level 2", soakoff: "foreign", pedicure: "yes", pedicureType: "Gel pedicure", pediFrench: true });
  ok(m.includes("Ana!") && m.includes("2:00") && m.includes("Gel-X, Medium, Art level 2, Foreign soak-off"), "edit text carries the full appointment");
  ok(m.includes("Gel pedicure + French tips"), "edit text includes the pedicure and french tips");
  ok(m.length < 480, "edit text stays within three SMS segments");
}

// Nothing Textbelt could read as a link.
{
  const S2 = await load("utils/sms.js");
  const out = S2.stripLinks("Book at https://www.myasnailsbaby.com/#booking or myasnailsbaby.com. $20.50 at 2:00PM.");
  ok(!/https?:|[A-Za-z]\.[A-Za-z]{2,}|dot com/i.test(out), "links and bare domains are removed, not rewritten");
  ok(out.includes("$20.50") && out.includes("2:00PM"), "prices and times are left alone");
  ok(!/\w\.\w/.test(S2.plainText("DM @myasnailsbaby. myasnailsbaby.com")) && !S2.plainText("DM @x").includes("@"), "the last-resort version has no dots or @");
  const upd = M.updatedByMya({ name: "Ana", date: "2026-10-22", startTime: "14:00", service: "Gel-X" });
  ok(!/https?:|\w\.\w{2,}|Rd\./.test(upd), "the update text has no links and no abbreviation dots");
}

const S = await load("utils/seo.js");

// The suite number goes out only in the confirmation and reminder texts.
{
  const d = "2026-10-25", t = "10:00";
  const SUITE = /Suite 1\b|Suite #106|Room 4/;
  ok(SUITE.test(M.bookingConfirmation({ name: "A", date: d, startTime: t })), "confirmation text has the suite");
  ok(SUITE.test(M.reminder24h({ name: "A", date: d, startTime: t })), "day-before reminder has the suite");
  ok(SUITE.test(M.reminderDayOf({ name: "A", date: d, startTime: t })), "day-of reminder has the suite");
  ok(SUITE.test(M.reminder24h({ name: "A", date: "2026-10-15", startTime: t })), "old studio's suite too, before the move");
  ok(!SUITE.test(M.updatedByMya({ name: "A", date: d, startTime: t })), "edit text has no suite");
  ok(!SUITE.test(M.rescheduledByClient({ name: "A", oldDate: d, oldTime: t, newDate: d, newTime: t })), "reschedule text has no suite");
  ok(!SUITE.test(L.studioAddressFor(d)) && !SUITE.test(L.studioLines(d).join()), "addresses default to no suite");
  for (const day of ["2026-10-20", "2026-10-21"]) {
    ok(!SUITE.test(JSON.stringify(S.salonJsonLd(day)) + JSON.stringify(S.faqJsonLd(day))), `structured data has no suite (${day})`);
  }
  const { read: R } = await import("./helpers/repo.mjs");
  for (const f of ["pages/index.js", "pages/terms.jsx", "pages/privacy.jsx", "pages/services.jsx", "pages/success.js",
                   "pages/api/confirm-payment.js", "pages/api/reschedule-booking.js", "MARKETING.md"]) {
    ok(!/withUnit|Suite #106|Suite 1\b/.test(R(f)), `${f} never shows the suite`);
  }
}

// The public site and Google's copy of the address flip on move day too.
const before2 = S.salonJsonLd("2026-10-20"), after2 = S.salonJsonLd("2026-10-21");
ok(before2.address.streetAddress.includes("Flamingo") && before2.geo, "structured data says Flamingo, with its pin, until the move");
ok(after2.address.streetAddress.includes("Pecos") && after2.address.addressLocality === "Henderson" && after2.address.postalCode === "89074", "structured data says Pecos, Henderson 89074 from move day");
ok(!after2.geo, "no guessed coordinates for the new studio");
ok(JSON.stringify(S.faqJsonLd("2026-10-21")).includes("Pecos"), "FAQ answer moves too");

const { read } = await import("./helpers/repo.mjs");
for (const page of ["pages/terms.jsx", "pages/privacy.jsx", "pages/services.jsx"]) {
  const src = read(page);
  ok(!/Flamingo/.test(src), `${page} has no hardcoded address`);
  ok(/revalidate:\s*3600/.test(src), `${page} regenerates hourly so it flips without a deploy`);
}
ok(/salonJsonLd\(today\)/.test(read("pages/index.js")), "homepage structured data is date-aware");

h.done();
