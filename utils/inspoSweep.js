import { INSPO_BUCKET, MAX_PHOTOS, PENDING_PREFIX, orphanPaths } from "./inspo.js";

/**
 * Delete inspo photos that no booking ever claimed.
 *
 * Clients upload reference pictures before paying, because the booking row
 * doesn't exist until the Stripe webhook fires. Most of those become
 * bookings; the ones that don't — someone reaches the card form and leaves —
 * leave an object nothing points at. This is also what bounds an upload route
 * that has to be unauthenticated: storage can't grow without limit if what
 * nothing references is swept.
 *
 * It doubles as the delete path for Mya. Removing a photo in her dashboard
 * just drops it from the row's array, which makes it unreferenced, which
 * brings it here within the hour — so there's no destructive endpoint to
 * expose to get the same effect.
 *
 * THE DANGEROUS FAILURE MODE
 *
 * This is the only code in the app that deletes something a client gave us,
 * and it decides what to delete from the ABSENCE of a reference. So every way
 * of failing to see a reference has to stop the sweep rather than license a
 * delete: a failed query, a truncated page, a bucket that isn't there. An
 * orphan costs kilobytes. A wrong delete costs the picture someone came to
 * show Mya, and there is no undo.
 *
 * Lives here rather than inline in the cron engine so it can be tested with a
 * stub client — an untested function whose job is deleting things is not
 * something to take on trust.
 *
 * Never throws: the caller is the hourly job, and housekeeping must not fail
 * a run that has already sent texts.
 *
 * @param {object} supabase  a service-role client
 * @param {object} [opts]
 * @param {number} [opts.folderLimit]  booking folders examined per run
 * @param {Date|number} [opts.now]
 * @returns {Promise<{swept:number, skipped?:string}>}
 */
export async function sweepInspoOrphans(supabase, { folderLimit = 100, now = Date.now() } = {}) {
  try {
    const { data: folders, error: listErr } = await supabase.storage
      .from(INSPO_BUCKET)
      .list(PENDING_PREFIX, { limit: folderLimit });

    if (listErr) {
      // A missing bucket is the expected case until add_inspo.sql is run.
      console.error("Sweep: couldn't list inspo storage:", listErr.message);
      return { swept: 0, skipped: "list-failed" };
    }
    if (!folders?.length) return { swept: 0 };

    const referenced = await collectReferencedPaths(supabase);
    if (referenced.skipped) return { swept: 0, skipped: referenced.skipped };

    const objects = [];
    for (const folder of folders) {
      // Supabase inserts a hidden placeholder object for empty folders.
      if (!folder?.name || folder.name.startsWith(".")) continue;
      const prefix = `${PENDING_PREFIX}/${folder.name}`;
      const { data: files, error: fileErr } = await supabase.storage
        .from(INSPO_BUCKET)
        .list(prefix, { limit: MAX_PHOTOS + 1 });
      // Couldn't read this folder — so we can't tell what's in it. Skip it
      // rather than treat an unreadable folder as an empty one.
      if (fileErr) continue;
      for (const f of files || []) {
        if (!f?.name || f.name.startsWith(".")) continue;
        objects.push({
          name: `${prefix}/${f.name}`,
          created_at: f.created_at,
          updated_at: f.updated_at,
        });
      }
    }

    const doomed = orphanPaths({ objects, referenced: referenced.paths, now });
    if (doomed.length === 0) return { swept: 0 };

    const { error: rmErr } = await supabase.storage.from(INSPO_BUCKET).remove(doomed);
    if (rmErr) {
      console.error("Sweep: delete failed:", rmErr.message);
      return { swept: 0, skipped: "delete-failed" };
    }

    console.log(`Sweep: removed ${doomed.length} unclaimed inspo photo(s)`);
    return { swept: doomed.length };
  } catch (err) {
    console.error("Sweep: unexpected error:", err?.message || err);
    return { swept: 0, skipped: "error" };
  }
}

/**
 * Every storage path some booking points at.
 *
 * Paged deliberately. A plain .select() stops at PostgREST's default 1000
 * rows WITHOUT SAYING SO, and a truncated list here does not read as an
 * error — it reads as "those photos aren't referenced", which would delete
 * real clients' pictures once Mya passes a thousand bookings with photos.
 * Silence that looks like success is the same shape as the phantom sends,
 * so this pages until it sees a short page and refuses to report a set it
 * couldn't finish building.
 *
 * @returns {Promise<{paths: Set<string>} | {skipped: string}>}
 */
export async function collectReferencedPaths(supabase, { pageSize = 1000, maxPages = 100 } = {}) {
  const paths = new Set();
  let from = 0;

  for (let page = 0; page < maxPages; page++) {
    const { data: rows, error } = await supabase
      .from("bookings")
      .select("inspo_urls")
      .not("inspo_urls", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Sweep: skipped — couldn't read referenced photos:", error.message);
      return { skipped: "lookup-failed" };
    }

    for (const r of rows || []) for (const p of r?.inspo_urls || []) paths.add(p);

    // A short page means we've seen everything.
    if (!rows || rows.length < pageSize) return { paths };
    from += pageSize;
  }

  // Ran out of pages before running out of rows. Better to leak orphans than
  // to delete a photo off a real booking.
  console.error("Sweep: skipped — too many booking pages to enumerate safely.");
  return { skipped: "lookup-truncated" };
}
