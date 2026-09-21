"use client";

import { useEffect, useState } from "react";
import { galleryUrl } from "@/utils/storage";

/**
 * Mya's work, on Mya's website.
 *
 * This component existed but was imported by nothing, so the Gallery tab in
 * her dashboard uploaded into a void — every set she posted was visible only
 * to her. A nail artist's portfolio is the entire sell, and a visitor had to
 * leave for Instagram to see any of it.
 *
 * Photos are passed in as a prop rather than fetched here. The homepage loads
 * them in getServerSideProps so they're present in the HTML a crawler reads:
 * fetching in a useEffect would have put the whole portfolio behind JavaScript,
 * which is close to invisible for image search and slower for everyone else.
 *
 * `items` is [{ image_url, caption }].
 */
export default function NailGallery({ items = [], heading = "Recent Sets" }) {
  const [selected, setSelected] = useState(null);

  // Escape closes the lightbox. The old version could only be dismissed by
  // clicking, which left keyboard users trapped in it.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (!items.length) return null;

  /** Captions are Mya's own words and make the best alt text. The fallback is
   *  plain and true rather than a keyword list — a stuffed alt attribute is a
   *  spam signal, and it's read aloud to anyone using a screen reader. */
  const altFor = (item) =>
    item.caption?.trim() ? item.caption.trim() : "Custom nail set by Mya in Las Vegas";

  return (
    <section id="gallery" className="py-14 border-b border-stone-200">
      <h2
        className="text-5xl text-stone-900 text-center mb-10 section-title-accent"
        style={{ fontFamily: "'Great Vibes', cursive", color: "#1c1917" }}
      >
        {heading}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item) => (
          <figure key={item.image_url} className="m-0">
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="block w-full border border-stone-200 hover:border-stone-900 transition group"
              aria-label={`View larger: ${altFor(item)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={galleryUrl(item.image_url)}
                alt={altFor(item)}
                loading="lazy"
                className="w-full aspect-square object-cover group-hover:opacity-90 transition"
              />
            </button>
            {item.caption?.trim() && (
              <figcaption className="text-xs text-stone-500 mt-1.5 text-center">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={altFor(selected)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={galleryUrl(selected.image_url)}
            alt={altFor(selected)}
            className="max-w-full max-h-full object-contain"
          />
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="absolute top-4 right-4 text-white text-3xl leading-none px-3 py-1"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
