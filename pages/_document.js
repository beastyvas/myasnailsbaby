import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Great+Vibes&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Basic Meta */}
        <meta name="description" content="Book cute nail sets with Mya in Las Vegas 💅✨" />

        {/* Open Graph */}
        <meta property="og:title" content="Mya's Nails Baby" />
        <meta property="og:description" content="Book your next nail set with Mya — from Gel-X to full glam!" />
        <meta property="og:image" content="https://www.myasnailsbaby.com/og-image.png" />
        <meta property="og:url" content="https://www.myasnailsbaby.com" />
        <meta property="og:type" content="website" />

        {/* Twitter Card (optional) */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mya's Nails Baby" />
        <meta name="twitter:description" content="Cute sets. Vegas based. Book now." />
        <meta name="twitter:image" content="https://www.myasnailsbaby.com/og-image.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
