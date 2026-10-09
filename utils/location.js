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

/** First appointment date at the new suite (YYYY-MM-DD, Vegas date).
 *  Mya: "all appointments after 10/20 need to have the new address". */
export const MOVE_DATE = "2026-10-21";

export const OLD_STUDIO = {
  line1: "2080 E. Flamingo Rd. Suite #106, Room 4",
  line2: "Las Vegas, NV 89119",
};

export const NEW_STUDIO = {
  line1: "178 N Pecos Rd. Suite 1",
  line2: "Glamour Gains Studio Suites",
};

/** The studio for an appointment on `date`. No date → the current one. */
export function studioFor(date) {
  return date && String(date) >= MOVE_DATE ? NEW_STUDIO : OLD_STUDIO;
}

/** One line, for texts. */
export function studioAddressFor(date) {
  const s = studioFor(date);
  return `${s.line1}, ${s.line2}`;
}
