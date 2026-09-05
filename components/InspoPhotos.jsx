"use client";

import { useId, useRef, useState } from "react";
import { downscaleToJpegDataUrl } from "@/utils/downscale";
import { MAX_PHOTOS } from "@/utils/inspo";
import { inspoUrl } from "@/utils/storage";

/**
 * Inspo photos — the client's reference pictures for a set.
 *
 * Two components, one file, because they have to agree about what a photo
 * looks like: InspoStrip shows them, InspoUploader adds and removes them.
 * Both are used on the booking form and in Mya's dashboard, so a change to
 * either can't leave the two views disagreeing.
 */

/**
 * Read-only thumbnails.
 *
 * Used wherever Mya is looking at a booking rather than editing it — the
 * Appointments card on the day, and the history rows in the Clients tab.
 * Renders nothing at all when there are no photos, so it can be dropped into
 * a layout unconditionally without leaving a gap on the bookings that don't
 * have any.
 */
export function InspoStrip({ paths, size = "md", label = "Inspo" }) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  if (list.length === 0) return null;

  const box = size === "sm" ? "w-14 h-14" : "w-20 h-20";

  return (
    <div className="mb-4">
      <p className="text-xs text-stone-400 uppercase tracking-wider mb-1.5">
        {label} ({list.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {list.map((path) => (
          <a
            key={path}
            href={inspoUrl(path)}
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-stone-200 hover:border-stone-900 transition"
            title="Open full size"
          >
            {/* Plain <img>: these are user uploads on a Supabase domain, and
                next/image would need that host allow-listed in next.config
                for no benefit at thumbnail size. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={inspoUrl(path)} alt="Inspiration" className={`${box} object-cover`} loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Add and remove photos.
 *
 * Uploads happen when a file is picked, not at submit, so the wait is spent
 * while someone finishes filling in the form rather than in front of the pay
 * button.
 *
 * A FAILED UPLOAD MUST NEVER COST A BOOKING. Every error path here ends in an
 * inline message on that one thumbnail and nothing else — the form stays
 * submittable, and the appointment goes through without the photo. A reference
 * picture is a nicety; the booking is the point.
 *
 * Slots, not a list: there are exactly MAX_PHOTOS storage paths per booking,
 * so the cap is a property of the namespace rather than a counter someone has
 * to remember to check. Re-picking a slot overwrites it.
 *
 * @param {object} props
 * @param {string|(() => string)} props.bookingId  uuid the paths are keyed to.
 *   May be a function, resolved at upload time rather than during render —
 *   the booking form mints its uuid lazily, and calling that during a server
 *   render would produce a different id than the browser's and break
 *   hydration.
 * @param {string[]} props.paths      storage paths already attached
 * @param {(paths: string[]) => void} props.onChange
 */
export function InspoUploader({ bookingId, paths, onChange, label = "Inspo photos", hint }) {
  const saved = Array.isArray(paths) ? paths.filter(Boolean) : [];
  const fileRef = useRef(null);
  // Stable across server and client, unlike anything derived from the uuid.
  const inputId = useId();
  // Per-slot transient UI: a local preview while uploading, or an error.
  // Keyed by path so it survives the parent re-rendering.
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);

  const total = saved.length + pending.filter((p) => !p.error).length;
  const room = Math.max(0, MAX_PHOTOS - total);

  /** The lowest slot index not already taken. */
  function freeSlot(taken) {
    for (let i = 0; i < MAX_PHOTOS; i++) if (!taken.has(i)) return i;
    return null;
  }

  function slotOf(path) {
    const m = /\/(\d+)\.jpg$/.exec(path || "");
    return m ? Number(m[1]) : null;
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    // Let the same file be picked again after a removal.
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;

    const taken = new Set(
      [...saved.map(slotOf), ...pending.filter((p) => !p.error).map((p) => p.slot)].filter(
        (n) => n !== null
      )
    );

    const accepted = files.slice(0, Math.max(0, MAX_PHOTOS - taken.size));
    if (accepted.length === 0) return;

    // Resolved here, not in render: on the booking form this mints the uuid
    // the whole checkout is keyed to.
    const id = typeof bookingId === "function" ? bookingId() : bookingId;

    setBusy(true);
    for (const file of accepted) {
      const slot = freeSlot(taken);
      if (slot === null) break;
      taken.add(slot);

      const pendingId = `${slot}-${Date.now()}`;
      let preview = "";
      try {
        preview = await downscaleToJpegDataUrl(file);
      } catch {
        setPending((prev) => [...prev, { id: pendingId, slot, error: "Couldn't read that photo" }]);
        continue;
      }

      setPending((prev) => [...prev, { id: pendingId, slot, preview }]);

      try {
        const res = await fetch("/api/upload-inspo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: id, index: slot, dataUrl: preview }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.path) throw new Error(json.error || "Upload failed");

        // Hand the path up, then drop the local preview — the thumbnail is
        // now backed by the stored file.
        onChange([...saved.filter((p) => slotOf(p) !== slot), json.path]);
        setPending((prev) => prev.filter((p) => p.id !== pendingId));
      } catch (err) {
        setPending((prev) =>
          prev.map((p) =>
            p.id === pendingId ? { ...p, error: err.message || "Couldn't attach that one" } : p
          )
        );
      }
    }
    setBusy(false);
  }

  function removeSaved(path) {
    // Dropping it from the list is the whole removal. The object becomes
    // unreferenced, and the hourly sweep in the cron engine reclaims it —
    // so there's no delete endpoint to expose.
    onChange(saved.filter((p) => p !== path));
  }

  const thumb = "w-20 h-20 object-cover";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{label}</label>
        <span className="text-xs text-stone-400">
          {total}/{MAX_PHOTOS}
        </span>
      </div>

      {hint && <p className="text-xs text-stone-500 mb-2">{hint}</p>}

      {(saved.length > 0 || pending.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {saved.map((path) => (
            <div key={path} className="relative border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inspoUrl(path)} alt="Inspiration" className={thumb} />
              <button
                type="button"
                onClick={() => removeSaved(path)}
                aria-label="Remove photo"
                className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 text-xs leading-none transition"
              >
                ✕
              </button>
            </div>
          ))}

          {pending.map((p) => (
            <div key={p.id} className="relative border border-stone-200">
              {p.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.preview} alt="Uploading" className={`${thumb} opacity-40`} />
              ) : (
                <div className={`${thumb} bg-stone-100`} />
              )}
              <div className="absolute inset-0 flex items-center justify-center text-center px-1">
                {p.error ? (
                  <span className="text-[10px] text-rose-700 leading-tight">{p.error}</span>
                ) : (
                  <span className="text-[10px] text-stone-600">Adding…</span>
                )}
              </div>
              {p.error && (
                <button
                  type="button"
                  onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                  aria-label="Dismiss"
                  className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-stone-300 text-stone-600 hover:border-stone-900 text-xs leading-none transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        disabled={room === 0 || busy}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className={`inline-block border px-4 py-2 text-sm transition ${
          room === 0 || busy
            ? "border-stone-200 text-stone-400 cursor-not-allowed"
            : "border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer"
        }`}
      >
        {busy ? "Adding…" : room === 0 ? `${MAX_PHOTOS} photos added` : "+ Add inspo photo"}
      </label>
    </div>
  );
}
