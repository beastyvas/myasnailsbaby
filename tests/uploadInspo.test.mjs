/**
 * /api/upload-inspo — the real handler, not a copy of its logic.
 *
 * The claim being tested is not "bad input gets a 4xx". It's that bad input
 * never reaches storage: the stub records every call, so a rejection that
 * still uploaded would fail here even though the status code looked right.
 */
import { register } from "node:module";

// The hook has to be registered before the route is imported, which is why
// these are dynamic imports rather than top-level ones.
register(new URL("./helpers/loader.mjs", import.meta.url).href);

const stub = await import("./helpers/supabaseStub.mjs");
const { default: handler } = await import("../pages/api/upload-inspo.js");
const { MAX_BYTES, MAX_PHOTOS } = await import("../utils/inspo.js");

import { suite } from "./helpers/harness.mjs";

const { ok, done } = suite("uploadInspo");

const ID = "3f2b1c8a-9d4e-4f11-8b7a-0c6d5e4f3a2b";

/** A real JPEG byte stream of a given length, as a data URL. */
function jpegDataUrl(bytes = 64) {
  const buf = Buffer.alloc(bytes, 0x41);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function call(body, method = "POST") {
  stub.reset();
  let status = 200;
  let payload = null;
  const res = {
    status(c) {
      status = c;
      return this;
    },
    json(p) {
      payload = p;
      return this;
    },
    end(p) {
      payload = p;
      return this;
    },
  };
  await handler({ method, body }, res);
  return { status, payload, calls: [...stub.calls] };
}

// ── the happy path ───────────────────────────────────────────────────────
{
  const r = await call({ bookingId: ID, index: 0, dataUrl: jpegDataUrl() });
  ok("valid upload returns 200", r.status === 200, String(r.status));
  ok("valid upload returns the path", r.payload?.path === `pending/${ID}/0.jpg`, JSON.stringify(r.payload));
  ok("valid upload actually stored", r.calls.length === 1 && r.calls[0].op === "upload");
  ok("stored in the inspo bucket", r.calls[0]?.bucket === "inspo", r.calls[0]?.bucket);
  ok("stored as jpeg", r.calls[0]?.opts?.contentType === "image/jpeg");
  ok("upsert on, so a slot is replaced not duplicated", r.calls[0]?.opts?.upsert === true);
}

// ── every rejection must not touch storage ───────────────────────────────
const rejections = [
  ["GET refused", { bookingId: ID, index: 0, dataUrl: jpegDataUrl() }, 405, "GET"],
  ["missing booking id", { index: 0, dataUrl: jpegDataUrl() }, 400],
  ["non-uuid booking id", { bookingId: "abc", index: 0, dataUrl: jpegDataUrl() }, 400],
  ["path traversal in booking id", { bookingId: "../../gallery/x", index: 0, dataUrl: jpegDataUrl() }, 400],
  ["slot above the cap", { bookingId: ID, index: MAX_PHOTOS, dataUrl: jpegDataUrl() }, 400],
  ["slot far above the cap", { bookingId: ID, index: 7, dataUrl: jpegDataUrl() }, 400],
  ["negative slot", { bookingId: ID, index: -1, dataUrl: jpegDataUrl() }, 400],
  ["string slot", { bookingId: ID, index: "0", dataUrl: jpegDataUrl() }, 400],
  ["missing image", { bookingId: ID, index: 0 }, 400],
  ["empty image", { bookingId: ID, index: 0, dataUrl: "data:image/jpeg;base64," }, 400],
  ["not a data url", { bookingId: ID, index: 0, dataUrl: "https://evil.example/x.jpg" }, 400],
  ["oversize", { bookingId: ID, index: 0, dataUrl: jpegDataUrl(MAX_BYTES + 1) }, 413],
  [
    "png rejected despite a jpeg mime label",
    {
      bookingId: ID,
      index: 0,
      dataUrl: `data:image/jpeg;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64")}`,
    },
    415,
  ],
  [
    "svg rejected",
    {
      bookingId: ID,
      index: 0,
      dataUrl: `data:image/jpeg;base64,${Buffer.from('<svg onload="alert(1)">').toString("base64")}`,
    },
    415,
  ],
  [
    "text named jpeg rejected",
    { bookingId: ID, index: 0, dataUrl: `data:image/jpeg;base64,${Buffer.from("not an image").toString("base64")}` },
    415,
  ],
];

for (const [name, body, expected, method] of rejections) {
  const r = await call(body, method || "POST");
  ok(`${name} → ${expected}`, r.status === expected, `got ${r.status}`);
  // The property that actually matters.
  ok(`${name} never reached storage`, r.calls.length === 0, `${r.calls.length} storage call(s)`);
}

// No body at all must not throw.
{
  const r = await call(undefined);
  ok("missing body handled", r.status === 400 && r.calls.length === 0, String(r.status));
}

// ── a storage failure is reported, not swallowed ─────────────────────────
{
  stub.reset();
  stub.setUploadResult({ error: { message: "bucket not found" } });
  let status = 0;
  let payload = null;
  await handler(
    { method: "POST", body: { bookingId: ID, index: 1, dataUrl: jpegDataUrl() } },
    { status(c) { status = c; return this; }, json(p) { payload = p; return this; } }
  );
  ok("storage failure is a 500", status === 500, String(status));
  ok("storage failure returns no path", !payload?.path, JSON.stringify(payload));
  stub.setUploadResult({ error: null });
}

// A caller can't be handed a path that wasn't written — the phantom-send
// class of bug, in a different costume.
done();
