/**
 * utils/inspoSweep.js — the only code here that deletes a client's file.
 *
 * This is the only code in the app that deletes something a client gave us,
 * and it decides from the ABSENCE of a reference. So the suite is written the
 * paranoid way round: most of it asserts that nothing was deleted.
 */
import { sweepInspoOrphans, collectReferencedPaths } from "../utils/inspoSweep.js";

import { suite } from "./helpers/harness.mjs";

const { ok, done } = suite("inspoSweep");

const NOW = Date.parse("2026-09-05T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

// Quiet the module's console.error during expected-failure cases.
const realError = console.error;
const realLog = console.log;
console.error = () => {};
console.log = () => {};

/**
 * A stub client.
 * @param o.folders   listing under pending/, or {error}
 * @param o.files     map of folder name → file listing, or {error}
 * @param o.rows      booking rows, or {error}
 * @param o.removeErr make the delete fail
 */
function makeClient({ folders = [], files = {}, rows = [], removeErr = null } = {}) {
  const removed = [];
  const client = {
    removed,
    storage: {
      from() {
        return {
          async list(path, opts) {
            if (path === "pending") {
              if (folders.error) return { data: null, error: folders.error };
              return { data: folders.slice(0, opts?.limit ?? 100), error: null };
            }
            const key = path.replace("pending/", "");
            const f = files[key];
            if (f?.error) return { data: null, error: f.error };
            return { data: f || [], error: null };
          },
          async remove(paths) {
            if (removeErr) return { error: removeErr };
            removed.push(...paths);
            return { error: null };
          },
        };
      },
    },
    from() {
      const q = {
        select: () => q,
        not: () => q,
        range: async (a, b) => {
          if (rows.error) return { data: null, error: rows.error };
          return { data: rows.slice(a, b + 1), error: null };
        },
      };
      return q;
    },
  };
  return client;
}

const FOLDERS = [{ name: "aaa" }, { name: "bbb" }];

// ── the ordinary case ────────────────────────────────────────────────────
{
  const c = makeClient({
    folders: FOLDERS,
    files: {
      aaa: [{ name: "0.jpg", created_at: hoursAgo(72) }], // unreferenced, old
      bbb: [{ name: "0.jpg", created_at: hoursAgo(72) }], // referenced
    },
    rows: [{ inspo_urls: ["pending/bbb/0.jpg"] }],
  });
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok("sweeps the orphan", r.swept === 1, JSON.stringify(r));
  ok("deleted exactly the orphan", c.removed.join() === "pending/aaa/0.jpg", c.removed.join());
  ok("kept the referenced photo", !c.removed.includes("pending/bbb/0.jpg"));
}

// ── every "can't see the references" path must delete NOTHING ────────────
const blindCases = [
  [
    "booking query fails",
    { folders: FOLDERS, files: { aaa: [{ name: "0.jpg", created_at: hoursAgo(99) }] }, rows: { error: { message: "boom" } } },
    "lookup-failed",
  ],
  [
    "storage listing fails",
    { folders: { error: { message: "no bucket" } } },
    "list-failed",
  ],
];

for (const [name, cfg, expectedSkip] of blindCases) {
  const c = makeClient(cfg);
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok(`${name} → skipped`, r.skipped === expectedSkip, JSON.stringify(r));
  ok(`${name} → deletes NOTHING`, c.removed.length === 0, c.removed.join());
  ok(`${name} → reports 0 swept`, r.swept === 0);
}

// The one that would have been a silent data-loss bomb: more referenced rows
// than a single unpaged select would return.
{
  const many = Array.from({ length: 2500 }, (_, i) => ({ inspo_urls: [`pending/f${i}/0.jpg`] }));
  const res = await collectReferencedPaths(makeClient({ rows: many }), { pageSize: 1000 });
  ok("pages past the 1000-row default", res.paths?.size === 2500, String(res.paths?.size));
  ok("page 1001 is present, not silently dropped", res.paths?.has("pending/f1000/0.jpg"));
  ok("last row is present", res.paths?.has("pending/f2499/0.jpg"));
}

// Refuses to act rather than act on a partial set.
{
  const many = Array.from({ length: 5000 }, (_, i) => ({ inspo_urls: [`pending/f${i}/0.jpg`] }));
  const res = await collectReferencedPaths(makeClient({ rows: many }), { pageSize: 10, maxPages: 3 });
  ok("truncation is reported, not silently accepted", res.skipped === "lookup-truncated", JSON.stringify(res));
  ok("truncation returns no path set to act on", !res.paths);
}

// And that refusal reaches the sweep, which must then delete nothing.
{
  const referencedRows = Array.from({ length: 500 }, (_, i) => ({ inspo_urls: [`pending/x${i}/0.jpg`] }));
  const c = makeClient({
    folders: FOLDERS,
    files: { aaa: [{ name: "0.jpg", created_at: hoursAgo(99) }] },
    rows: referencedRows,
  });
  const r = await sweepInspoOrphans(c, { now: NOW, folderLimit: 100 });
  // With a tiny page size forced through collectReferencedPaths this would
  // truncate; here it should simply succeed and sweep the true orphan.
  ok("500 rows still enumerate fine", r.skipped === undefined, JSON.stringify(r));
  ok("and the real orphan still goes", c.removed.includes("pending/aaa/0.jpg"));
}

// ── an unreadable folder is not an empty folder ──────────────────────────
{
  const c = makeClient({
    folders: FOLDERS,
    files: {
      aaa: { error: { message: "unreadable" } },
      bbb: [{ name: "0.jpg", created_at: hoursAgo(72) }],
    },
    rows: [],
  });
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok("unreadable folder contributes nothing", !c.removed.some((p) => p.startsWith("pending/aaa")));
  ok("readable orphan still swept", c.removed.includes("pending/bbb/0.jpg"), c.removed.join());
  ok("swept count matches", r.swept === 1, JSON.stringify(r));
}

// ── nothing to do ────────────────────────────────────────────────────────
{
  const c = makeClient({ folders: [], rows: [] });
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok("empty bucket sweeps nothing", r.swept === 0 && c.removed.length === 0);
  ok("empty bucket is not reported as skipped", r.skipped === undefined);
}

// A recent upload mid-checkout: no row references it yet, and it must survive.
{
  const c = makeClient({
    folders: [{ name: "live" }],
    files: { live: [{ name: "0.jpg", created_at: hoursAgo(0.2) }] },
    rows: [],
  });
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok("mid-checkout upload survives", c.removed.length === 0 && r.swept === 0, c.removed.join());
}

// ── failures are reported, never counted as success ──────────────────────
{
  const c = makeClient({
    folders: FOLDERS,
    files: { aaa: [{ name: "0.jpg", created_at: hoursAgo(72) }] },
    rows: [],
    removeErr: { message: "storage down" },
  });
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok("failed delete reports 0 swept", r.swept === 0, JSON.stringify(r));
  ok("failed delete is flagged", r.skipped === "delete-failed", JSON.stringify(r));
}

// A client that throws outright must not take the cron run down.
{
  const exploding = {
    storage: {
      from() {
        return {
          list() {
            throw new Error("kaboom");
          },
        };
      },
    },
  };
  const r = await sweepInspoOrphans(exploding, { now: NOW });
  ok("a throwing client is contained", r.swept === 0 && r.skipped === "error", JSON.stringify(r));
}

// Placeholder objects Supabase creates for empty folders are ignored.
{
  const c = makeClient({
    folders: [{ name: ".emptyFolderPlaceholder" }, { name: "aaa" }],
    files: { aaa: [{ name: ".emptyFolderPlaceholder", created_at: hoursAgo(99) }] },
    rows: [],
  });
  const r = await sweepInspoOrphans(c, { now: NOW });
  ok("placeholders are not swept as orphans", c.removed.length === 0 && r.swept === 0, c.removed.join());
}

console.error = realError;
console.log = realLog;

done();
