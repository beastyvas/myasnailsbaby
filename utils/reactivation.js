/** The reactivation campaign: text lapsed clients an offer, then credit a
 *  later booking from that number back to the text that caused it.
 *
 *  THERE IS NO CODE FOR THE CLIENT TO REDEEM. Attribution has always been by
 *  phone number — the webhook matches a new booking against a live offer for
 *  that number, because almost nobody types a code back. The code was only
 *  ever decoration on top of that, and asking someone to remember one is a
 *  reason for the offer to fail rather than a way to claim it.
 *
 *  So the client is simply told to book, and Mya is told to take the discount
 *  off at the chair. `reactivation_sends.code` still exists as an internal
 *  reference for the row; it is never shown to a client or to Mya.
 *
 *  Imported by both the API routes and the dashboard, so everything here is
 *  browser-safe — no node:crypto, no server-only imports. */

/** No visit in this long, with nothing on the books, and Mya has lost them.
 *  Nail clients rebook on a two-to-three week rhythm, so six weeks of
 *  silence is a real lapse rather than someone who's simply due. */
export const DORMANT_AFTER_DAYS = 45;

/** How long an offer stays honorable and attributable. Someone who books
 *  three weeks after the text still counts — that's the behaviour the
 *  campaign exists to cause. */
export const WINDOW_DAYS = 30;

/** Sanity rails for the offer set in the dashboard. */
export const MIN_PERCENT = 5;
export const MAX_PERCENT = 50;
export const DEFAULT_PERCENT = 20;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** An internal reference for a reactivation_sends row — not a coupon.
 *
 *  Nobody is ever asked to type this. It exists because the column is
 *  `not null unique`, and because a short handle is easier to grep for in a
 *  log than a uuid when working out why an offer was or wasn't credited.
 *
 *  Web Crypto rather than node:crypto — this module is bundled for the
 *  dashboard too, and getRandomValues exists in both runtimes. */
export function newCode() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(5));
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `MYA${code}`;
}

export function clampPercent(n) {
  const parsed = Number(n);
  if (!Number.isFinite(parsed)) return DEFAULT_PERCENT;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(parsed)));
}

export function firstNameOf(full) {
  return String(full ?? "").trim().split(/\s+/)[0] || "love";
}

/** "Aug 30" — short enough to sit inside a text without eating a segment.
 *
 *  Takes both an instant (an offer's expires_at) and a plain calendar date
 *  (a booking's `date` column), which need opposite handling: "2026-08-12"
 *  parses as UTC midnight, so rendering it in Pacific moved it back to the
 *  11th and every appointment date in an alert was a day early. A bare date
 *  is anchored at midday and read as-is; a real timestamp is converted. */
export function prettyDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

/** Whole days between a YYYY-MM-DD appointment date and today. */
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

/** Price after the discount, rounded to the dollar so the number Mya says
 *  out loud matches the number on her screen. */
export function discountedCents(priceCents, percentOff) {
  if (!priceCents || !percentOff) return priceCents || 0;
  return Math.round((priceCents * (100 - percentOff)) / 100 / 100) * 100;
}

/**
 * The text itself.
 *
 * Deliberately link-free. Textbelt refuses messages containing a URL until
 * the sending domain is whitelisted, so the call to action is the site name
 * and her handle — both of which work from the lock screen.
 *
 * And deliberately code-free. The discount is applied by Mya at the chair,
 * not claimed by the client at checkout, so there is nothing to remember,
 * mistype, or lose. Telling someone the offer is already attached to them is
 * also a stronger invitation than handing them homework.
 */
export function reactivationMessage({ name, daysSinceVisit, percentOff, expiresAt }) {
  const first = firstNameOf(name);

  const months = daysSinceVisit ? Math.round(daysSinceVisit / 30) : 0;
  const gap =
    months >= 2
      ? `It's been about ${months} months `
      : daysSinceVisit && daysSinceVisit >= 30
        ? "It's been over a month "
        : "It's been a little while ";

  return (
    `Mya's Nails Baby: Hi ${first}! It's Mya 💅 ${gap}since I did your nails and I miss you.\n` +
    `Come back and I'll take ${percentOff}% off your next set — good through ${prettyDate(expiresAt)}.\n` +
    `No code needed, I've got you down. Just book on my site or DM @myasnailsbaby and I'll take it off when you're in my chair.\n` +
    `(Reply STOP and I won't send these.)`
  );
}

/**
 * The alert Mya gets the moment a reactivation text turns into a booking.
 *
 * This is the whole mechanism from her side: the client is flagged, and this
 * text tells her what to knock off. It names the actual dollar figure when
 * the booking carries a quote, because "20% off" at the chair is a sum to do
 * in her head while someone waits, and that is where the offer quietly
 * doesn't get honored.
 */
export function ownerAlert({
  clientName, service, date, startTime, percentOff, quotedCents, depositCents = 2000,
}) {
  const head =
    `THEY CAME BACK! ${clientName} just booked after your miss-you text.\n` +
    `${service || "Appointment"} — ${prettyDate(date)} at ${startTime}\n`;

  if (!quotedCents) {
    // No quote stored (a legacy booking, or selections that couldn't be
    // priced). Still tell her the important half.
    return `${head}Honor ${percentOff}% off when they sit down.`;
  }

  const after = discountedCents(quotedCents, percentOff);
  const due = Math.max(0, after - depositCents);
  return (
    `${head}Honor ${percentOff}% off: $${after / 100} instead of $${quotedCents / 100} ` +
    `(they owe $${due / 100} at the visit, $${depositCents / 100} deposit already paid).`
  );
}

/**
 * Roll bookings up into one row per client, then decide who's lapsed.
 *
 * @param {Array}  bookings  every booking, newest or oldest order irrelevant
 * @param {Array}  sends     rows from reactivation_sends
 * @param {Set}    optedOut  normalized phone numbers that replied STOP
 * @param {Function} normalize  phone normalizer, passed in so this file
 *                              stays free of server imports
 */
export function buildClients(bookings, sends, optedOut, normalize) {
  const today = new Date().toISOString().slice(0, 10);
  const byPhone = new Map();

  for (const b of bookings) {
    const phone = normalize(b.phone);
    // No usable number means no way to text them — they can't be an audience.
    if (!phone) continue;

    if (!byPhone.has(phone)) {
      byPhone.set(phone, {
        phone,
        name: b.name || "",
        instagram: b.instagram || "",
        visits: 0,
        upcoming: 0,
        lastVisit: null,
        daysSinceVisit: null,
        dormant: false,
        optedOut: optedOut.has(phone),
        offer: null,
      });
    }
    const c = byPhone.get(phone);
    if (!c.name && b.name) c.name = b.name;
    if (!c.instagram && b.instagram) c.instagram = b.instagram;

    // A refunded or cancelled slot was never a visit, and a no-show is a
    // separate problem from a lapse — neither should read as "they came".
    if (b.refunded) continue;

    if (b.date > today) {
      c.upcoming++;
    } else {
      c.visits++;
      if (!c.lastVisit || b.date > c.lastVisit) c.lastVisit = b.date;
    }
  }

  // Latest send per number, so an old expired offer doesn't mask a live one.
  const latestSend = new Map();
  for (const s of sends) {
    const prev = latestSend.get(s.phone);
    if (!prev || s.sent_at > prev.sent_at) latestSend.set(s.phone, s);
  }

  const now = new Date().toISOString();
  for (const c of byPhone.values()) {
    c.daysSinceVisit = daysSince(c.lastVisit);
    c.dormant =
      c.visits > 0 && c.upcoming === 0 && (c.daysSinceVisit ?? 0) > DORMANT_AFTER_DAYS;

    const send = latestSend.get(c.phone);
    if (send && (send.booking_id || send.expires_at > now)) {
      c.offer = {
        code: send.code,
        percentOff: send.percent_off,
        sentAt: send.sent_at,
        expiresAt: send.expires_at,
        booked: !!send.booking_id,
      };
    }
  }

  return [...byPhone.values()].sort(
    (a, b) => (b.daysSinceVisit ?? 0) - (a.daysSinceVisit ?? 0)
  );
}

/** Everyone the campaign would text right now: lapsed, nothing on the books,
 *  not opted out, and not already holding an offer they haven't used. */
export function eligibleFrom(clients) {
  return clients.filter((c) => c.dormant && !c.optedOut && !c.offer);
}

/**
 * How the campaign is doing.
 *
 * Deliberately counts bookings and deposits rather than revenue: service
 * prices aren't in the database (Mya quotes them per set), so any dollar
 * figure beyond the deposit would be invented.
 */
export function buildStats(sends, bookingsById) {
  const now = new Date().toISOString();
  let live = 0;
  let booked = 0;
  let deposits = 0;
  let lastSentAt = null;

  for (const s of sends) {
    if (!lastSentAt || s.sent_at > lastSentAt) lastSentAt = s.sent_at;

    if (!s.booking_id) {
      if (s.expires_at > now) live++;
      continue;
    }
    const b = bookingsById.get(s.booking_id);
    // A refunded booking isn't a win — don't count it either way.
    if (!b || b.refunded) continue;
    booked++;
    if (b.paid) deposits += 20;
  }

  return { sent: sends.length, live, booked, deposits, lastSentAt };
}
