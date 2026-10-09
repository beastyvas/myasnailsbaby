/** Where the appointment is.
 *
 *  Mya moves suites on the cut-over date below. Every appointment-specific
 *  message (texts, emails, the success page) picks its address from the
 *  appointment's own date, so someone booked for before the move is still
 *  sent to Flamingo and someone booked after is sent to Pecos — with no
 *  deploy needed on the day.
 *
 *  The public pages (homepage, services, terms, privacy and the structured
 *  data Google reads) pass TODAY's date instead, so the site's own address
 *  flips on MOVE_DATE as well. Those pages regenerate at least hourly, so
 *  the switch lands within an hour of midnight with no deploy.
 *
 *  Browser-safe and dependency-free: the success page imports it too.
 */

/** First appointment date at the new suite (YYYY-MM-DD, Vegas date). */
export const MOVE_DATE = "2026-10-21";

export const OLD_STUDIO = {
  name: null,
  street: "2080 E. Flamingo Rd. Suite #106, Room 4",
  city: "Las Vegas",
  region: "NV",
  postalCode: "89119",
  cityLine: "Las Vegas, NV 89119",
  /** "a private suite on …" — for prose. */
  area: "E. Flamingo Rd, Las Vegas",
  mapQuery: "2080 E Flamingo Rd, Las Vegas, NV 89119",
  /** From the studio's map pin — lets Google place the business precisely. */
  latitude: 36.1136458,
  longitude: -115.1218948,
};

export const NEW_STUDIO = {
  name: "Glamour Gains Studio Suites",
  street: "178 N Pecos Rd. Suite 1",
  city: "Henderson",
  region: "NV",
  postalCode: "89074",
  cityLine: "Henderson, NV 89074",
  area: "N Pecos Rd, Henderson",
  mapQuery: "178 N Pecos Rd, Henderson, NV 89074",
  // No map-pin coordinates yet. Google geocodes the address itself; add
  // them here once the Business Profile pin is set and they'll be published.
  latitude: null,
  longitude: null,
};

/** The studio for an appointment on `date`. No date → the old one, which is
 *  only reached by a page that couldn't read the booking's date at all. */
export function studioFor(date) {
  return date && String(date) >= MOVE_DATE ? NEW_STUDIO : OLD_STUDIO;
}

/** The address as display lines: building name (if any), street, city. */
export function studioLines(date) {
  const s = studioFor(date);
  return [s.name, s.street, s.cityLine].filter(Boolean);
}

/** Street plus city line, e.g. for a page's contact block. */
export function studioPostal(studio) {
  return `${studio.street}, ${studio.cityLine}`;
}

/** One line, for texts. */
export function studioAddressFor(date) {
  return studioLines(date).join(", ");
}

/** A keyless Google Maps embed for a studio. */
export function mapEmbedUrl(studio) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(studio.mapQuery)}&z=15&output=embed`;
}
