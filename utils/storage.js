/**
 * Public URLs for Supabase Storage objects.
 *
 * The project URL is currently spelled out by hand in five places
 * (dashboard.js three times, index.js, NailGallery.jsx). That was survivable
 * while there was one bucket; the inspo bucket makes it two, so new code goes
 * through here instead of adding a sixth copy.
 *
 * Derived from NEXT_PUBLIC_SUPABASE_URL — the same variable the client is
 * built from, so a project move can't leave image URLs pointing at the old
 * one. The literal fallback is the project those five call sites already
 * hardcode, so behaviour is unchanged if the variable is ever missing.
 */

import { INSPO_BUCKET } from "./inspo.js";

const PROJECT_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ywpyfrothdaademzkpnl.supabase.co"
).replace(/\/$/, "");

/** Public URL for an object in a public bucket. */
export function publicUrl(bucket, path) {
  if (!path) return "";
  // Already absolute — a preview URL or a value someone pasted in.
  if (/^https?:\/\//i.test(path)) return path;
  return `${PROJECT_URL}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`;
}

/** An inspo photo a client attached to their booking. */
export function inspoUrl(path) {
  return publicUrl(INSPO_BUCKET, path);
}

/** Mya's portfolio and profile pictures. */
export function galleryUrl(path) {
  return publicUrl("gallery", path);
}
