/**
 * Feature switches.
 *
 * Browser-safe and dependency-free, so the dashboard, the API routes and the
 * cron engine can all read the same value.
 */

/**
 * Growth features: the rebooking nudge and the reactivation campaign.
 *
 * OFF. Turned off deliberately, not because anything is broken — the code is
 * complete, tested and working. Flip this to `true` and all of it comes back:
 * the Reactivate tab, the campaign endpoint, the "you're due for a fill"
 * text, and the settings that control them.
 *
 * Deliberately a single named constant rather than commenting out four call
 * sites, so restoring it is a one-line diff instead of an archaeology
 * exercise.
 *
 * NOT covered by this switch, on purpose: appointment reminders, review
 * requests and abandoned-checkout recovery. Reminders in particular are core
 * service rather than marketing — a client who paid a deposit expects to be
 * reminded — so they keep running.
 */
export const GROWTH_ENABLED = false;
