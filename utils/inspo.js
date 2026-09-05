/**
 * Inspo photos — the rules, as code.
 *
 * A client attaches reference pictures to their booking. The awkward part is
 * the ordering: the booking row does not exist yet when the upload happens.
 * The form uploads before checkout, the webhook inserts the row after payment,
 * and Postgres generates the row id — so the only identifier available at
 * upload time is the uuid the browser makes in handleSubmit. Everything here
 * exists to carry a photo across that gap safely.
 *
 * Pure and dependency-free, like credits.js and windows.js, so the form, the
 * upload route, the webhook and the cron sweep all agree on the same rules and
 * every one of them can be tested without a database or a network.
 */

/** Named once so the upload route, the sweep and the URL helper can't drift
 *  onto different buckets. Created by supabase/migrations/add_inspo.sql. */
export const INSPO_BUCKET = "inspo";

/** Three references is what people actually have: shape, colour, design. */
export const MAX_PHOTOS = 3;

/**
 * Hard ceiling on an upload, after the browser has downscaled it.
 *
 * A 1600px JPEG at quality 0.82 lands around 250KB, so 1.5MB is roughly six
 * times the expected size — generous enough that a legitimate photo is never
 * refused, small enough that the route can't be used to push real volume.
 */
export const MAX_BYTES = 1_500_000;

/** Stripe rejects a metadata value over this, and the failure would take the
 *  whole checkout session with it. */
export const STRIPE_METADATA_MAX = 500;

/** Where uploads live until a booking claims them. Everything under this
 *  prefix is fair game for the sweep once it's old and unreferenced. */
export const PENDING_PREFIX = "pending";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The browser generates these with uuidv4; anything else is a caller we
 *  didn't write, and it doesn't get to pick storage paths. */
export function isBookingId(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isPhotoIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < MAX_PHOTOS;
}

/**
 * The storage path for one photo.
 *
 * Fully determined by a validated uuid and a small integer, so it can contain
 * no comma, no slash beyond the two here, and nothing a client typed. That is
 * exactly what makes the comma-joined metadata encoding below safe, and it's
 * asserted in the tests rather than left as a comment nobody rechecks.
 *
 * Slot-based rather than append-based: picking a fourth photo is impossible
 * because there is no fourth slot, and re-picking the second overwrites it.
 * The count cap is enforced by the shape of the namespace, not by a counter
 * somebody has to remember to check.
 */
export function inspoPath(bookingId, index) {
  if (!isBookingId(bookingId)) throw new Error("inspoPath: invalid bookingId");
  if (!isPhotoIndex(index)) throw new Error("inspoPath: index out of range");
  return `${PENDING_PREFIX}/${bookingId.toLowerCase()}/${index}.jpg`;
}

/**
 * Pack paths into a single Stripe metadata value.
 *
 * Stripe metadata is flat strings only, so the list has to survive as one.
 * Three paths comma-joined is about 150 characters against a 500 limit; the
 * throw is there because silently sending an over-long value would fail the
 * checkout session itself, and losing a booking over a decoration is the one
 * outcome this feature must never produce.
 */
export function encodeInspoPaths(paths) {
  if (!Array.isArray(paths)) return "";
  const clean = paths.filter((p) => typeof p === "string" && p && !p.includes(","));
  const encoded = clean.slice(0, MAX_PHOTOS).join(",");
  if (encoded.length > STRIPE_METADATA_MAX) {
    throw new Error(`encodeInspoPaths: ${encoded.length} chars exceeds Stripe's ${STRIPE_METADATA_MAX}`);
  }
  return encoded;
}

/**
 * Unpack it on the way into the booking row.
 *
 * Returns null rather than an empty array for "no photos", matching how
 * quoted_cents handles "" in the same insert — a text[] column with one empty
 * string in it would render as a broken image on Mya's dashboard, which is
 * worse than rendering nothing.
 */
export function decodeInspoPaths(value) {
  if (typeof value !== "string") return null;
  const paths = value.split(",").map((p) => p.trim()).filter(Boolean).slice(0, MAX_PHOTOS);
  return paths.length ? paths : null;
}

/**
 * Is this actually a JPEG?
 *
 * The browser re-encodes every pick through a canvas, so a real client always
 * sends JPEG regardless of what came off their phone. That lets the server
 * demand JPEG and reject everything else outright — a HEIC, a PNG, an SVG full
 * of script, or a file merely named .jpg — instead of trusting a Content-Type
 * header the caller chose.
 */
export function isJpeg(bytes) {
  if (!bytes || bytes.length < 3) return false;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Which pending objects the sweep should delete.
 *
 * Abandoned checkouts are the normal case: someone uploads a photo, reaches
 * the card form and leaves. Nothing ever references that object, so without
 * this it sits in storage forever. It's also the real bound on abuse of an
 * unauthenticated upload route — storage cannot grow without limit if what
 * nothing references is swept daily.
 *
 * Two guarantees, in this order, because both failure modes are bad in
 * different ways: never delete something a booking points at (that's a photo
 * disappearing off a real appointment), and never delete something recent
 * (that's a photo vanishing mid-checkout, before the row exists to claim it).
 *
 * @param {object}   o
 * @param {{name:string, created_at?:string}[]} o.objects  storage listing
 * @param {Iterable<string>} o.referenced  paths any booking row points at
 * @param {Date|number}      o.now
 * @param {number}           o.maxAgeHours grace period before an unreferenced
 *                                         object is considered abandoned
 * @returns {string[]} paths to delete
 */
export function orphanPaths({ objects, referenced, now = Date.now(), maxAgeHours = 24 } = {}) {
  if (!Array.isArray(objects)) return [];
  const keep = referenced instanceof Set ? referenced : new Set(referenced || []);
  const cutoff = (now instanceof Date ? now.getTime() : now) - maxAgeHours * 3600 * 1000;

  return objects
    .filter((obj) => {
      const name = obj?.name;
      if (typeof name !== "string" || !name) return false;
      if (keep.has(name)) return false;

      // No timestamp means we can't prove it's old. Keeping an orphan costs a
      // few kilobytes; deleting a photo someone is mid-checkout with costs
      // them the reference they came to show Mya.
      const created = Date.parse(obj.created_at ?? obj.updated_at ?? "");
      if (!Number.isFinite(created)) return false;

      return created < cutoff;
    })
    .map((obj) => obj.name);
}
