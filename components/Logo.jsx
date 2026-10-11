/**
 * Mya's MNB monogram.
 *
 * A plain <img> on purpose: it's a small static file in /public, and the
 * image optimizer would only add a round trip for it. The alt text is the
 * business name, so the header still reads "Mya's Nails Baby" to screen
 * readers and crawlers exactly as the old text wordmark did.
 */
export default function Logo({ className = "h-10 w-auto", white = false }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={white ? "/logo-white-sm.png" : "/logo-sm.png"}
      alt="Mya's Nails Baby"
      width={300}
      height={233}
      className={className}
    />
  );
}
