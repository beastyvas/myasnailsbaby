/**
 * Is the automation engine actually alive, and can it still send?
 *
 * Pure functions, no imports — so the dashboard, the API route and the tests
 * can all use them, and none of it needs a database to verify. Same reasoning
 * as utils/windows.js.
 *
 * THE POINT OF THIS FILE: before it, silence was ambiguous. No failure email
 * meant either "everything is fine" or "the engine hasn't run in a day and
 * nobody noticed" — and there was no way to tell which. GitHub cancelled two
 * runs for lack of a runner on the day this was written, so that second case
 * is not hypothetical.
 */

/**
 * How long without a run before we call it stopped.
 *
 * Deliberately generous. The schedule is nominally hourly but GitHub throttles
 * it to every 2–4 hours, with a worst observed gap of 4h06m. A threshold near
 * that would cry wolf constantly, and an alert that's usually wrong is one
 * nobody reads. Six hours is comfortably past normal drift while still
 * catching a genuine stoppage the same day.
 */
export const STALE_AFTER_HOURS = 6;

/** Below this many Textbelt credits, say something while there's still time
 *  to act. A few days of normal sending, not an hour's warning. */
export const LOW_CREDITS = 15;

/**
 * @param {string|Date|null} lastRunAt  when the engine last completed
 * @param {number} now                  ms since epoch, injectable for tests
 * @returns {{ stale: boolean, hoursAgo: number|null, neverRan: boolean }}
 */
export function runHealth(lastRunAt, now = Date.now()) {
  if (!lastRunAt) {
    // Never having run is not the same as being stale, and the two want
    // different words on screen: one is "not set up yet", the other is
    // "it was working and stopped".
    return { stale: true, hoursAgo: null, neverRan: true };
  }

  const t = lastRunAt instanceof Date ? lastRunAt.getTime() : Date.parse(lastRunAt);
  if (Number.isNaN(t)) return { stale: true, hoursAgo: null, neverRan: true };

  const hoursAgo = (now - t) / 3_600_000;
  return {
    // A clock skew putting the last run slightly in the future is not a
    // stoppage — clamp rather than report a negative age as healthy-looking.
    stale: hoursAgo > STALE_AFTER_HOURS,
    hoursAgo: Math.max(0, hoursAgo),
    neverRan: false,
  };
}

/**
 * Null means unknown — the key isn't configured, or the quota check failed.
 * Unknown must never read as "low", or a missing key would produce a scary
 * banner about credits that aren't actually gone.
 */
export function creditsLow(creditsLeft) {
  return typeof creditsLeft === "number" && creditsLeft < LOW_CREDITS;
}

/** True when the last run reported sends it couldn't complete. */
export function hadFailures(failures) {
  if (Array.isArray(failures)) return failures.length > 0;
  return typeof failures === "number" && failures > 0;
}

/**
 * One overall verdict for the dashboard banner.
 *
 * `quiet_hours` is explicitly NOT a problem: a run that held everything for
 * the morning still proves the engine is alive. Treating it as a fault would
 * mean a red banner every night.
 *
 * @returns {"ok"|"stale"|"never"|"failing"|"low-credits"}
 */
export function overallHealth({ lastRunAt, creditsLeft, failures } = {}, now = Date.now()) {
  const { stale, neverRan } = runHealth(lastRunAt, now);
  if (neverRan) return "never";
  // Not running at all outranks everything else — nothing can send.
  if (stale) return "stale";
  if (hadFailures(failures)) return "failing";
  if (creditsLow(creditsLeft)) return "low-credits";
  return "ok";
}
