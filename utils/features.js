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

/**
 * The client-facing "cancel my appointment" flow.
 *
 * OFF. Mya would rather people text her to cancel, so she can handle the
 * deposit case by case instead of the site deciding by policy. Rescheduling
 * is untouched — she likes it, it works, and it's the path she wants clients
 * using anyway.
 *
 * This also parks the deposit-credit system: a client cancellation is its
 * only trigger, so nothing writes to client_credits and applyClientCredit()
 * in the webhook finds an empty ledger. utils/credits.js and its tests stay
 * put — she said she'd think about the credit idea, and a flag is a one-line
 * flip where a rebuild is not.
 *
 * The /cancel-appointment page stays in the repo, unlinked and inert.
 */
export const CLIENT_CANCEL_ENABLED = false;

/**
 * Mya's portfolio on the public homepage.
 *
 * OFF. She doesn't want it, and it's her work and her site.
 *
 * Worth recording what this costs so the decision can be revisited with the
 * facts rather than re-argued from memory: "Myas nails baby photos" is one of
 * the searches Google itself suggests for her name, and with this off the
 * answer is nowhere on the site — a visitor has to leave for Instagram to see
 * any of her sets. Her nail photos were also the only image content the site
 * had for image search.
 *
 * The Gallery tab in her dashboard is untouched. She can keep uploading, and
 * those photos stay visible to her; they just don't render publicly. So
 * flipping this to `true` brings the section back with whatever she's posted
 * in the meantime already in it.
 */
export const PUBLIC_GALLERY_ENABLED = false;
