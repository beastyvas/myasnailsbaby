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
ok(after.includes("178 N Pecos") && !after.includes("Flamingo"), "reminder after the move says Pecos");
ok(M.bookingConfirmation({ name: "Ana", date: "2026-11-01", startTime: "10:00" }).includes("Pecos"), "confirmation after the move says Pecos");
ok(M.movedByMya({ name: "Ana", oldDate: "2026-10-15", oldTime: "10:00", newDate: "2026-10-25", newTime: "10:00" }).includes("Pecos"), "moved past the cut-over uses the new date's address");

ok(F.EXTRA_TEXTS_ENABLED === false, "extra automated texts are off");
ok(F.GROWTH_ENABLED === false, "rebooking nudge is off");

h.done();
