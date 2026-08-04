/** Vegas time, done properly.
 *
 *  Bookings store `date` as YYYY-MM-DD and `start_time`/`end_time` as a
 *  local TIME — both Vegas wall-clock, with no offset attached. Turning that
 *  pair into a real instant is what every reminder, nudge and revenue figure
 *  depends on, so it lives here rather than being re-derived per handler.
 *
 *  The previous approach —
 *      new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))
 *  — reads a Vegas wall-clock string back as if it were server-local time.
 *  On a UTC server that produces an instant seven or eight hours off, which
 *  is why reminder windows never lined up. */

export const VEGAS_TZ = "America/Los_Angeles";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: VEGAS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** The Vegas wall-clock reading of an instant, as UTC-shaped milliseconds.
 *  Only meaningful when subtracted from the instant it came from. */
function wallClockMs(instant) {
  const p = {};
  for (const { type, value } of partsFormatter.formatToParts(instant)) p[type] = value;
  // hour23 renders midnight as "24" in some ICU versions
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
}

/** Milliseconds to add to an instant to get its Vegas wall clock (negative). */
function offsetMs(instant) {
  return wallClockMs(instant) - instant.getTime();
}

/** "2026-08-04" — today in Vegas, wherever the server happens to be. */
export function todayVegas() {
  return vegasParts(new Date()).date;
}

/** Split an instant into its Vegas date and time. */
export function vegasParts(instant = new Date()) {
  const p = {};
  for (const { type, value } of partsFormatter.formatToParts(instant)) p[type] = value;
  const hour = p.hour === "24" ? "00" : p.hour;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${hour}:${p.minute}:${p.second}`,
  };
}

/**
 * A Vegas date + time as a real instant.
 *
 * Solved by iteration rather than a hardcoded -7/-8: guess the instant using
 * the offset in force at roughly that moment, then correct once using the
 * offset actually in force at the guess. That lands on the right side of a
 * DST change, which a fixed offset cannot.
 */
export function vegasInstant(dateStr, timeStr = "00:00:00") {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = String(timeStr).split(":").map(Number);
  if (!y || !m || !d) return null;

  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  let instant = new Date(asIfUtc - offsetMs(new Date(asIfUtc)));
  instant = new Date(asIfUtc - offsetMs(instant));
  return instant;
}

/** Hours from now until a Vegas date+time. Negative once it's passed. */
export function hoursUntil(dateStr, timeStr, now = Date.now()) {
  const at = vegasInstant(dateStr, timeStr);
  if (!at) return null;
  return (at.getTime() - now) / 3_600_000;
}

/** Hours since a Vegas date+time passed. Negative while it's still ahead. */
export function hoursSince(dateStr, timeStr, now = Date.now()) {
  const h = hoursUntil(dateStr, timeStr, now);
  return h === null ? null : -h;
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** "8:00AM" from "08:00:00". Matches how times already read on the site. */
export function to12h(time24) {
  if (!time24) return "";
  const [hStr, mStr = "00"] = String(time24).split(":");
  const hour = parseInt(hStr, 10);
  if (Number.isNaN(hour)) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${mStr.padStart(2, "0")}${suffix}`;
}

/** "Tue, Aug 4" — short enough to sit inside a text. */
export function prettyDate(dateStr, { weekday = true } = {}) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    ...(weekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "YYYY-MM" for the month a Vegas date falls in. */
export function monthKey(dateStr) {
  return String(dateStr ?? "").slice(0, 7);
}
