import Link from "next/link";
import Seo from "@/components/Seo";
import Logo from "@/components/Logo";
import { absoluteUrl } from "@/utils/seo";

const sectionHeading = { fontFamily: "Georgia, serif" };

export async function getStaticProps() {
  const { allGuides, formatGuideDate, readingMinutes } = await import("@/utils/guides");
  return {
    props: {
      guides: allGuides().map((g) => ({
        slug: g.slug,
        title: g.title,
        h1: g.h1,
        description: g.description,
        dateLabel: formatGuideDate(g.date),
        minutes: readingMinutes(g),
      })),
    },
  };
}

export default function GuidesIndex({ guides }) {
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/guides/${g.slug}`),
      name: g.title,
    })),
  };

  return (
    <main className="min-h-screen bg-stone-50">
      <Seo
        path="/guides"
        title="Nail Guides — Gel-X, Structure Gel & Acrylic"
        description="Straight answers from Mya, a Henderson nail tech: how long each set lasts, Gel-X vs acrylic vs structure gel, aftercare, and what to expect at your appointment."
        // An empty index is a thin page — keep it out of search until the
        // first guide is published. The sitemap leaves it out too.
        noindex={guides.length === 0}
        jsonLd={guides.length ? list : null}
      />

      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="Home"><Logo className="h-14 w-auto" /></Link>
          <Link href="/#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition">Book</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-stone-900 mb-3" style={sectionHeading}>Nail guides</h1>
        <p className="text-stone-600 leading-relaxed max-w-2xl">
          The questions people ask me in the chair, answered properly — which set suits you, how long it
          lasts, and how to keep it looking good.
        </p>

        {guides.length === 0 ? (
          <p className="mt-10 text-stone-500">The first guide is on its way.</p>
        ) : (
          <ul className="mt-10 space-y-4">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="block bg-white border border-stone-200 p-6 hover:border-rose-800 transition">
                  <p className="text-xs uppercase tracking-wider text-stone-500">{g.dateLabel} · {g.minutes} min read</p>
                  <h2 className="text-2xl text-stone-900 mt-2" style={sectionHeading}>{g.h1}</h2>
                  <p className="text-stone-600 mt-2">{g.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
