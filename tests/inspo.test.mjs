/**
 * utils/inspo.js — paths, metadata encoding, file sniffing, orphan selection.
 *
 * Edge cases first: the things that would quietly lose a photo, quietly lose
 * a booking, or quietly delete someone's reference off a real appointment.
 */
import {
  MAX_PHOTOS,
  MAX_BYTES,
  STRIPE_METADATA_MAX,
  isBookingId,
  isPhotoIndex,
  inspoPath,
  encodeInspoPaths,
  decodeInspoPaths,
  isJpeg,
  orphanPaths,
} from "../utils/inspo.js";

import { suite } from "./helpers/harness.mjs";

const { ok, throws, done } = suite("inspo");

const ID = "3f2b1c8a-9d4e-4f11-8b7a-0c6d5e4f3a2b";

// ── path building ────────────────────────────────────────────────────────
ok("path shape", inspoPath(ID, 0) === `pending/${ID}/0.jpg`, inspoPath(ID, 0));

// The safety assumption the whole metadata encoding rests on.
for (let i = 0; i < MAX_PHOTOS; i++) {
  ok(`path ${i} has no comma`, !inspoPath(ID, i).includes(","));
}

ok("path lowercases the id", inspoPath(ID.toUpperCase(), 1) === `pending/${ID}/1.jpg`);

throws("index above the cap rejected", () => inspoPath(ID, MAX_PHOTOS));
throws("negative index rejected", () => inspoPath(ID, -1));
throws("non-integer index rejected", () => inspoPath(ID, 1.5));
throws("bad uuid rejected", () => inspoPath("../../etc/passwd", 0));
throws("empty id rejected", () => inspoPath("", 0));

// Path traversal must be impossible, not merely unlikely.
ok("no traversal via id", !isBookingId("../../secret"));
ok("no traversal via slash", !isBookingId(`${ID}/../x`));
ok("real uuid accepted", isBookingId(ID));
ok("index type guard", isPhotoIndex(0) && isPhotoIndex(2) && !isPhotoIndex("1") && !isPhotoIndex(3));

// ── metadata encoding ────────────────────────────────────────────────────
const three = [0, 1, 2].map((i) => inspoPath(ID, i));

ok("encode joins", encodeInspoPaths(three) === three.join(","));
ok(
  "encode of a full set fits Stripe's cap",
  encodeInspoPaths(three).length < STRIPE_METADATA_MAX,
  `${encodeInspoPaths(three).length} chars`
);

// Five in, three out — the cap can't be bypassed by the caller.
const five = [...three, "pending/x/3.jpg", "pending/x/4.jpg"];
ok("encode truncates past the cap", encodeInspoPaths(five).split(",").length === MAX_PHOTOS);

ok("encode of nothing is empty string", encodeInspoPaths([]) === "");
ok("encode of null is empty string", encodeInspoPaths(null) === "");
ok("encode drops a comma-bearing path", encodeInspoPaths(["a,b", three[0]]) === three[0]);

// The bug this exists to prevent: [""] on the row, rendering as a broken img.
ok("decode of empty is null", decodeInspoPaths("") === null);
ok("decode of null is null", decodeInspoPaths(null) === null);
ok("decode of undefined is null", decodeInspoPaths(undefined) === null);
ok("decode of a lone comma is null", decodeInspoPaths(",") === null);
ok("decode trims stray space", JSON.stringify(decodeInspoPaths(` ${three[0]} `)) === JSON.stringify([three[0]]));
ok("decode caps at MAX_PHOTOS", decodeInspoPaths(five.join(",")).length === MAX_PHOTOS);

// ── round trip: form → Stripe metadata → webhook insert ──────────────────
const meta = { inspo_urls: encodeInspoPaths(three) };
ok(
  "round trip is exact",
  JSON.stringify(decodeInspoPaths(meta.inspo_urls)) === JSON.stringify(three),
  JSON.stringify(decodeInspoPaths(meta.inspo_urls))
);
ok("round trip of no photos → null on the row", decodeInspoPaths(encodeInspoPaths([])) === null);

// ── file sniffing ────────────────────────────────────────────────────────
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const heic = Uint8Array.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
const svg = new TextEncoder().encode('<svg onload="alert(1)">');
const text = new TextEncoder().encode("this is not a jpeg at all");

ok("jpeg accepted", isJpeg(jpeg));
ok("png rejected", !isJpeg(png));
ok("gif rejected", !isJpeg(gif));
ok("heic rejected", !isJpeg(heic));
ok("svg rejected", !isJpeg(svg));
ok("text named .jpg rejected", !isJpeg(text));
ok("empty rejected", !isJpeg(new Uint8Array()));
ok("truncated rejected", !isJpeg(Uint8Array.from([0xff, 0xd8])));
ok("null rejected", !isJpeg(null));

ok("size cap is a real limit", MAX_BYTES > 0 && MAX_BYTES < 5_000_000);

// ── orphan sweep ─────────────────────────────────────────────────────────
const NOW = Date.parse("2026-09-05T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

const listing = [
  { name: "pending/a/0.jpg", created_at: hoursAgo(72) }, // old, unreferenced → sweep
  { name: "pending/b/0.jpg", created_at: hoursAgo(72) }, // old, but on a booking
  { name: "pending/c/0.jpg", created_at: hoursAgo(1) },  // mid-checkout right now
  { name: "pending/d/0.jpg", created_at: hoursAgo(23) }, // just inside the grace
  { name: "pending/e/0.jpg", created_at: hoursAgo(25) }, // just outside → sweep
  { name: "pending/f/0.jpg" },                            // no timestamp
];
const referenced = new Set(["pending/b/0.jpg"]);
const swept = orphanPaths({ objects: listing, referenced, now: NOW });

ok("sweeps the old orphan", swept.includes("pending/a/0.jpg"));
ok("sweeps just past the grace period", swept.includes("pending/e/0.jpg"));

// The two guarantees that matter.
ok("NEVER deletes a referenced path", !swept.includes("pending/b/0.jpg"));
ok("NEVER deletes a mid-checkout upload", !swept.includes("pending/c/0.jpg"));
ok("respects the grace boundary", !swept.includes("pending/d/0.jpg"));
ok("keeps what it can't date", !swept.includes("pending/f/0.jpg"));
ok("sweeps exactly two", swept.length === 2, JSON.stringify(swept));

// Referencing everything must sweep nothing, whatever the ages.
ok(
  "all-referenced sweeps nothing",
  orphanPaths({ objects: listing, referenced: listing.map((o) => o.name), now: NOW }).length === 0
);

// An array works as well as a Set — the caller shouldn't have to know.
ok(
  "accepts an array of referenced paths",
  !orphanPaths({ objects: listing, referenced: ["pending/b/0.jpg"], now: NOW }).includes("pending/b/0.jpg")
);

ok("empty listing is fine", orphanPaths({ objects: [], referenced: [], now: NOW }).length === 0);
ok("garbage listing is fine", orphanPaths({ objects: null }).length === 0);
ok("no args is fine", orphanPaths().length === 0);
ok("junk entries skipped", orphanPaths({ objects: [null, {}, { name: 5 }], referenced: [], now: NOW }).length === 0);

// A booking older than the grace period must still hold its photos forever.
ok(
  "a year-old referenced photo survives",
  orphanPaths({
    objects: [{ name: "pending/z/0.jpg", created_at: hoursAgo(24 * 365) }],
    referenced: ["pending/z/0.jpg"],
    now: NOW,
  }).length === 0
);

done();
