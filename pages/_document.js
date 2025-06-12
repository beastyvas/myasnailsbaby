import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
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
