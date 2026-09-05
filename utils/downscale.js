/**
 * Shrink a photo in the browser before it's uploaded.
 *
 * Phone cameras produce 4-8MB files. Sending those anywhere is slow on the
 * cell connection someone is booking from, and it would mean the upload route
 * had to accept multi-megabyte bodies. Drawing through a canvas at a sane size
 * turns one into roughly 250KB, which uploads in a blink and is still far more
 * detail than a thumbnail on a phone screen needs.
 *
 * It also normalizes the format. iPhones hand over HEIC, which Safari can
 * decode but nothing else can display — re-encoding everything to JPEG means
 * the server accepts exactly one format and Mya's dashboard can render every
 * photo, whatever the client's phone produced.
 *
 * Browser-only: canvas and FileReader don't exist on the server, so this is
 * imported by client components only.
 */

/** Long edge, in pixels. Comfortably sharp full-screen on a phone. */
export const MAX_EDGE = 1600;

/** JPEG quality. 0.82 is the usual knee — visually clean, a third the bytes
 *  of 0.95. */
export const QUALITY = 0.82;

/**
 * @param {File|Blob} file
 * @returns {Promise<string>} a `data:image/jpeg;base64,...` URL
 */
export function downscaleToJpegDataUrl(file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));

    const url = URL.createObjectURL(file);
    const img = new Image();

    // Always release the object URL, on both paths — a booking form someone
    // fiddles with for a while would otherwise hold every photo they tried.
    const done = (fn) => (arg) => {
      URL.revokeObjectURL(url);
      fn(arg);
    };
    const ok = done(resolve);
    const fail = done(reject);

    img.onerror = () => fail(new Error("Could not read that image"));
    img.onload = () => {
      try {
        const { width, height } = img;
        if (!width || !height) return fail(new Error("Empty image"));

        // Only ever shrink. Scaling a small photo up would invent detail and
        // cost bytes for nothing.
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        if (!ctx) return fail(new Error("Canvas unavailable"));

        // JPEG has no alpha, and an unpainted canvas is transparent black —
        // so a PNG with transparency would come out with black edges without
        // this.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = "high";
        // Drawing an HTMLImageElement applies EXIF orientation in current
        // browsers, so a photo taken sideways stays the right way up.
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (!dataUrl.startsWith("data:image/jpeg")) {
          return fail(new Error("Could not convert that image"));
        }
        ok(dataUrl);
      } catch (e) {
        fail(e);
      }
    };

    img.src = url;
  });
}
