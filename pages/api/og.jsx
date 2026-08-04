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
  const cream = "#FAF7F1";
  const ink = "#231D18";
  const gold = "#B08D57";

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
          background: cream,
          color: ink,
          // a soft gold vignette so the card doesn't read as a plain box
          backgroundImage: `radial-gradient(circle at 50% 0%, #FBF6EA 0%, ${cream} 60%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 14,
            textTransform: "uppercase",
            color: gold,
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
            background: gold,
            marginTop: 40,
            marginBottom: 40,
          }}
        />

        <div style={{ display: "flex", fontSize: 34, color: "#4E453B" }}>
          Gel-X · Acrylic · Hard Gel · Nail Art · Pedicures
        </div>

        <div style={{ display: "flex", fontSize: 27, color: "#8C7D68", marginTop: 28 }}>
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
