/**
 * When each automated text is due.
 *
 * WHY THESE ARE SO WIDE
 *
 * The job is called "Hourly automations" and it is not hourly. GitHub
 * throttles free-tier scheduled workflows hard — observed gaps between real
 * runs on a single day:
 *
 *   00:05 → 04:11 → 07:38 → 10:38 → 12:56 → 15:15 → 17:47
 *
 * That's 2h18m to 4h06m apart. The original windows were two hours wide
 * (a 24h reminder fired only between 23 and 25 hours out), so a four-hour
 * gap meant the run that should have sent it simply never happened, and the
 * text was skipped in silence. Nothing errored; the client just didn't get
 * reminded.
 *
 * These bounds are wide enough that a late run still catches everything.
 * That is only safe because `sms_log` makes sending once-only: the engine's
 * sendOnce() claims a (booking, kind) row before it texts, and the unique
 * constraint rejects the second attempt. So a wide window cannot cause a
 * duplicate text — it can only stop us sending none.
 *
 * The trade is precision for reliability. A reminder that lands near the
 * right moment every time beats one timed to the hour that doesn't arrive.
 */

/** Hours before the appointment. The message says "tomorrow", so the top has
 *  to stay inside a day, and the floor is set where the day-of message
 *  becomes the more sensible thing to send. */
export const REMIND_24H_MIN = 6;
export const REMIND_24H_MAX = 26;

/** Hours before the appointment for the day-of nudge. Runs to 0 because a
 *  reminder is still worth sending an hour out; capped at the 24h floor so
 *  the two can never both fire for the same booking. */
export const DAY_OF_MAX = REMIND_24H_MIN;

/** Hours after the appointment ended. The floor of 2 is deliberate — it's
 *  while they're still looking at their hands. The ceiling is a catch-up
 *  bound: a review ask more than a day late reads as an afterthought, and
 *  without a ceiling every past booking would be asked at once. */
export const REVIEW_MIN = 2;
export const REVIEW_MAX = 24;

/** Days past the fill interval that a rebooking nudge stays eligible. The
 *  window was already a full day, which tolerates any normal gap; two covers
 *  the scheduler being down for a whole day. Steady state is unchanged —
 *  sms_log still means each client gets exactly one. */
export const REBOOK_GRACE_DAYS = 2;

/** `until` is hours until the appointment starts (positive = future). */
export function dueFor24hReminder(until) {
  return until !== null && until >= REMIND_24H_MIN && until <= REMIND_24H_MAX;
}

export function dueForDayOf(until) {
  return until !== null && until > 0 && until < DAY_OF_MAX;
}

/** `sinceEnd` is hours since the appointment ended. */
export function dueForReview(sinceEnd) {
  return sinceEnd !== null && sinceEnd >= REVIEW_MIN && sinceEnd <= REVIEW_MAX;
}

/**
 * Quiet hours, in Vegas local time. No automated text goes out before 8am or
 * after 9pm.
 *
 * This became necessary the moment the windows widened. A day-of reminder
 * that may fire up to 6 hours ahead, against an 8am Saturday appointment,
 * lands at 2am. The old 2–4h window had a milder version of the same problem
 * — 4am — so this was already a latent bug, just a quieter one.
 *
 * Skipping is safe precisely because the windows are now wide: a send passed
 * over at 2am is still comfortably inside its window when the job runs again
 * after 8am. The claim in sms_log is deliberately NOT taken when we skip, so
 * the next run genuinely retries rather than finding it already marked sent.
 */
export const QUIET_UNTIL = 8; // no sends before 8am
export const QUIET_FROM = 21; // no sends from 9pm

/** @param hour 0–23 in Vegas local time */
export function isQuietHour(hour) {
  return hour < QUIET_UNTIL || hour >= QUIET_FROM;
}

/** Both in days: how long since their last visit, and the fill interval. */
export function dueForRebook(sinceVisitDays, dueDays) {
  return (
    sinceVisitDays !== null &&
    sinceVisitDays >= dueDays &&
    sinceVisitDays <= dueDays + REBOOK_GRACE_DAYS
  );
}
