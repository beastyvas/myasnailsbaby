/** Mya's price list, as code.
 *
 *  Transcribed from her published list. Everything is in cents so nothing
 *  ever depends on float arithmetic, and this module is pure and
 *  browser-safe — the booking form and the server both import it, which is
 *  what stops the estimate a client sees from disagreeing with the figure
 *  stored on the booking.
 *
 *  When prices change, change them here and nowhere else.
 */

export const DEPOSIT_CENTS = 2000;
export const SPA_PEDI_CENTS = 1000;

/** Sets priced by nail length. Keys match the form's Length values. */
const BY_LENGTH = {
  "Small/Xtra Small": 0,
  Medium: 1,
  Large: 2,
  XL: 3,
  XXL: 4,
};

export const LENGTH_OPTIONS = Object.keys(BY_LENGTH);

/**
 * Every bookable service.
 *
 * `lengths` is the five-price ladder (XS/S → XXL). `flat` is a single price
 * with no length. `openEnded` marks a service whose top length the list
 * itself prints with a "+" — acrylic XXL is "$95+", because a genuinely
 * enormous custom set can run over.
 *
 * KEY ORDER IS THE MENU ORDER. The booking form and both dashboard dropdowns
 * render straight from this object, so reordering here reorders them all.
 * That's deliberate — the list used to be hardcoded in four places and had
 * already drifted apart.
 *
 * `legacy: true` means "still price it, never offer it": the key is a value
 * stored on real bookings that Mya no longer sells under that name.
 */
export const SERVICES = {
  // Mya's order, from her list.
  "Gel-X": { label: "Gel-X", lengths: [4500, 5500, 6500, 7500, 8500] },
  "Gel Manicure": { label: "Gel Manicure", flat: 4500 },
  "Structure Gel Manicure": { label: "Structure Gel Manicure", flat: 5500 },
  "Hard Gel with Tips": {
    label: "Hard Gel with Tips",
    lengths: [5500, 6500, 7500, 8500, 9500],
    openEnded: true,
  },
  "Hard Gel Manicure": { label: "Hard Gel Manicure", flat: 6000 },
  Acrylic: { label: "Acrylic", lengths: [5500, 6500, 7500, 8500, 9500], openEnded: true },
  "Basic Manicure": { label: "Basic Manicure (no polish)", flat: 3500 },

  // Structure gel and builder gel are the same service — Mya asked for the
  // name change. The old name is the string sitting on every historical
  // booking, so it has to keep resolving or those bookings would stop pricing
  // on her dashboard. Same reason the typo'd pedicure key below is still here.
  // Priced identically and labelled with the new name, so old bookings read
  // correctly too.
  "Builder Gel Manicure": { label: "Structure Gel Manicure", flat: 5500, legacy: true },
};

/** The services to actually offer, in Mya's order — legacy names excluded. */
export const BOOKABLE_SERVICES = Object.entries(SERVICES)
  .filter(([, svc]) => !svc.legacy)
  .map(([value, svc]) => ({ value, ...svc }));

/** Added on top of the base set. French tips sits here rather than with the
 *  levels because the list prices it as its own thing. */
export const ART_LEVELS = {
  "N/A": 0,
  "Level 1": 2000,
  "Level 2": 3000,
  "Level 3": 4000,
  "Level 4": 5000,
  "French Tips": 1500,
};

export const REMOVALS = {
  none: 0,
  "soak-off": 1000,
  foreign: 2000,
};

/** The typo'd key is Mya's original form value and is still stored on every
 *  historical booking, so it has to keep resolving. */
export const PEDICURES = {
  "Gel pedicure": 5000,
  "Gel pedicure + Acrylic big toes": 5500,
  "Gel pedciure + Acrylic big toes": 5500, // legacy spelling — do not remove
  "Acrylic Pedicure": 6500,
};

export function isLengthPriced(service) {
  return !!SERVICES[service]?.lengths;
}

/** "$145" — whole dollars, because every price on her list is round. */
export function formatPrice(cents) {
  if (cents == null || !Number.isFinite(cents)) return "";
  return `$${Math.round(cents / 100)}`;
}

/**
 * What to show a human for a stored service value.
 *
 * A booking saved as "Builder Gel Manicure" displays as "Structure Gel
 * Manicure", so the rename reaches history instead of only new bookings.
 * Anything unrecognised is passed through untouched rather than blanked —
 * showing the raw stored value beats showing nothing.
 */
export function serviceLabel(value) {
  return SERVICES[value]?.label || value || "";
}

/**
 * "Gel-X — from $45", "Basic Manicure (no polish) — $35".
 *
 * Derived rather than typed into the markup, so a price change in this file
 * can't leave a stale figure sitting in the dropdown. "from" for anything
 * priced by length, since the menu shows the shortest.
 */
export function serviceMenuLabel(value) {
  const svc = SERVICES[value];
  if (!svc) return value;
  if (svc.flat != null) return `${svc.label} — ${formatPrice(svc.flat)}`;
  return `${svc.label} — from ${formatPrice(svc.lengths[0])}`;
}

/**
 * Price a set of selections.
 *
 * Returns line items rather than just a number so the summary can show the
 * client exactly how the figure was reached — an unexplained total invites a
 * DM asking what it covers, which is the thing this feature exists to stop.
 *
 * @returns {{
 *   lines: {label: string, cents: number}[],
 *   total: number,
 *   isFrom: boolean,   // true when a component is open-ended ("$95+")
 *   unknown: boolean,  // a selection couldn't be priced — show nothing
 *   depositCents: number,
 *   balanceCents: number
 * }}
 */
export function quote({
  bookingNails,
  service,
  length,
  artLevel,
  soakoff,
  pedicure,
  pedicureType,
  spaPedi,
} = {}) {
  const lines = [];
  let isFrom = false;
  let unknown = false;

  const wantsNails = bookingNails === "yes";
  const wantsPedi = pedicure === "yes";

  if (wantsNails) {
    const svc = SERVICES[service];
    if (!svc) {
      // Either nothing chosen yet, or a legacy value like the old combined
      // "Hard Gel". Either way there is no honest number to show.
      if (service) unknown = true;
    } else if (svc.flat != null) {
      lines.push({ label: svc.label, cents: svc.flat });
    } else {
      const idx = BY_LENGTH[length];
      if (idx == null) {
        // Includes the retired "XL/XXL" option, which spanned two prices.
        if (length && length !== "N/A") unknown = true;
      } else {
        lines.push({ label: `${svc.label} — ${length}`, cents: svc.lengths[idx] });
        if (svc.openEnded && idx === svc.lengths.length - 1) isFrom = true;
      }
    }

    const art = ART_LEVELS[artLevel];
    if (art) lines.push({ label: artLevel === "French Tips" ? "French tips" : `Art ${artLevel.toLowerCase()}`, cents: art });
    if (artLevel && art === undefined) unknown = true;

    const removal = REMOVALS[soakoff];
    if (removal) {
      lines.push({ label: soakoff === "foreign" ? "Foreign soak-off" : "Soak-off", cents: removal });
    }
  }

  if (wantsPedi) {
    const pedi = PEDICURES[pedicureType];
    if (pedi == null) {
      if (pedicureType) unknown = true;
    } else {
      // Normalize the label so the legacy typo never reaches a client.
      const label = pedicureType.replace("pedciure", "pedicure");
      lines.push({ label, cents: pedi });
      if (spaPedi) lines.push({ label: "Spa pedi (soak, scrub, mask)", cents: SPA_PEDI_CENTS });
    }
  }

  const total = lines.reduce((n, l) => n + l.cents, 0);

  return {
    lines,
    total,
    isFrom,
    unknown,
    depositCents: DEPOSIT_CENTS,
    // The deposit counts toward the service, so this is what's owed at the
    // chair. Never negative, even if she ever prices something under $20.
    balanceCents: Math.max(0, total - DEPOSIT_CENTS),
  };
}

/** True when there's a figure worth putting on screen. */
export function hasQuote(q) {
  return !!q && !q.unknown && q.total > 0;
}
