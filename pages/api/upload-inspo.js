// File: /pages/api/upload-inspo.js
import { createClient } from "@supabase/supabase-js";
import {
  INSPO_BUCKET,
  MAX_BYTES,
  inspoPath,
  isBookingId,
  isJpeg,
  isPhotoIndex,
} from "@/utils/inspo";

/**
 * Attach an inspo photo to a booking that doesn't exist yet.
 *
 * WHY THIS IS A SERVER ROUTE AND NOT A BROWSER UPLOAD
 *
 * The dashboard uploads to storage straight from the browser, but the
 * dashboard is behind a Supabase session. The booking form is not, so copying
 * that pattern would mean opening the bucket to anonymous writes — an
 * unauthenticated write endpoint with no way to check size, type or count.
 * Holding the service-role key here means the checks below are the only way
 * in, and every one of them runs before a single byte reaches storage.
 *
 * This route is deliberately unauthenticated: a client uploads before they
 * pay, so there is no session and no booking to authorize against. What bounds
 * it instead:
 *
 *   - only three slots exist per booking id, so no folder can grow
 *   - each upload is capped at MAX_BYTES and must really be a JPEG
 *   - the bucket enforces its own size and MIME limits underneath this
 *   - the hourly sweep deletes anything no booking ever claimed
 *
 * The last one is what actually stops storage growing without limit, since
 * anyone can mint fresh uuids. Nothing here is worth stealing and nothing is
 * overwritten but the caller's own slot.
 */

// SERVICE ROLE: the inspo bucket takes no anonymous writes, by design — this
// route is the only way in, which is what makes the checks below meaningful.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    // The browser downscales to ~250KB before sending. 3mb leaves room for
    // base64's 33% inflation on an unusually large photo without letting a
    // caller push real volume through.
    bodyParser: { sizeLimit: "3mb" },
  },
};

/** Bytes out of a `data:image/jpeg;base64,...` URL, or null if it isn't one. */
function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.startsWith("data:")) return null;
  try {
    return Buffer.from(dataUrl.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { bookingId, index, dataUrl } = req.body || {};

  // Validate in cheapest-first order, and entirely before touching storage.
  // The uuid check is also the path-traversal guard: inspoPath only ever
  // builds a path from a matched uuid and a small integer, so nothing a
  // caller typed reaches the storage key.
  if (!isBookingId(bookingId)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }
  if (!isPhotoIndex(index)) {
    return res.status(400).json({ error: "Invalid photo slot" });
  }

  const bytes = decodeDataUrl(dataUrl);
  if (!bytes || bytes.length === 0) {
    return res.status(400).json({ error: "Could not read that image" });
  }
  if (bytes.length > MAX_BYTES) {
    return res.status(413).json({ error: "That photo is too large" });
  }
  // Sniffed, not trusted: the Content-Type on a data URL is whatever the
  // caller wrote. A real client always sends JPEG because the form re-encodes
  // through a canvas, so anything else is not a client we wrote.
  if (!isJpeg(bytes)) {
    return res.status(415).json({ error: "Photos must be JPEG" });
  }

  const path = inspoPath(bookingId, index);

  // upsert: re-picking a slot replaces it rather than accumulating, which is
  // what keeps the three-per-booking cap true no matter how many times
  // someone changes their mind.
  const { error } = await supabase.storage.from(INSPO_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) {
    console.error("⚠️ Inspo upload failed:", error.message);
    return res.status(500).json({ error: "Could not save that photo" });
  }

  return res.status(200).json({ path });
}
