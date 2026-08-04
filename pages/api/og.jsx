import { ImageResponse } from "next/og";

/** ImageResponse renders in a lightweight Satori runtime, not Node. */
export const config = { runtime: "edge" };

/**
 * The link-preview card, drawn on request at 1200×630.
 *
 * Generated rather than stored: the previous markup pointed at
 * /og-image.png, which was never actually added to the repo, so every share
 * on iMessage, Instagram or a text thread rendered a blank card. A route
 * can't go missing the way a file can, and it restyles with the site.
 */
export default function handler() {
  const stone = "#FAFAF9";
  const ink = "#1C1917";
  const maroon = "#9F1239";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: stone,
          color: ink,
          // a soft rose vignette so the card doesn't read as a plain box
          backgroundImage: `radial-gradient(circle at 50% 0%, #FDF2F4 0%, ${stone} 60%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 14,
            textTransform: "uppercase",
            color: maroon,
          }}
        >
          Las Vegas
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 118,
            fontWeight: 700,
            marginTop: 24,
            letterSpacing: -2,
          }}
        >
          Mya&apos;s Nails Baby
        </div>

        <div
          style={{
            display: "flex",
            width: 220,
            height: 3,
            background: maroon,
            marginTop: 40,
            marginBottom: 40,
          }}
        />

        <div style={{ display: "flex", fontSize: 34, color: "#44403C" }}>
          Gel-X · Acrylic · Hard Gel · Nail Art · Pedicures
        </div>

        <div style={{ display: "flex", fontSize: 27, color: "#78716C", marginTop: 28 }}>
          Book online · $20 deposit · @myasnailsbaby
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Crawlers and chat apps refetch this constantly; it only changes
        // when the code does.
        "Cache-Control": "public, immutable, no-transform, max-age=86400",
      },
    }
  );
}
