/** Where the appointment is.
 *
 *  Mya moves suites on the cut-over date below. Every appointment-specific
 *  message (texts, emails, the success page) picks its address from the
 *  appointment's own date, so someone booked for before the move is still
 *  sent to Flamingo and someone booked after is sent to Pecos — with no
 *  deploy needed on the day.
 *
 *  Browser-safe and dependency-free: the success page imports it too.
 */

/** First appointment date at the new suite (YYYY-MM-DD, Vegas date). */
export const MOVE_DATE = "2026-10-21";

export const OLD_STUDIO = {
  name: null,
  street: "2080 E. Flamingo Rd. Suite #106, Room 4",
  cityLine: "Las Vegas, NV 89119",
  mapQuery: "2080 E Flamingo Rd, Las Vegas, NV 89119",
};

export const NEW_STUDIO = {
  name: "Glamour Gains Studio Suites",
  street: "178 N Pecos Rd. Suite 1",
  cityLine: "Henderson, NV 89074",
  mapQuery: "178 N Pecos Rd, Henderson, NV 89074",
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

/** One line, for texts. */
export function studioAddressFor(date) {
  return studioLines(date).join(", ");
}

/** A keyless Google Maps embed for a studio. */
export function mapEmbedUrl(studio) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(studio.mapQuery)}&z=15&output=embed`;
}
