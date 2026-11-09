import Link from "next/link";
import Seo from "@/components/Seo";
import Logo from "@/components/Logo";
import { SITE_NAME, absoluteUrl, ogImageUrl, siteUrl } from "@/utils/seo";

const sectionHeading = { fontFamily: "Georgia, serif" };

/** A guide exists because its file does. Anything else is a 404. */
export async function getStaticPaths() {
  const { allGuides } = await import("@/utils/guides");
  return { paths: allGuides().map((g) => ({ params: { slug: g.slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  const { allGuides, guideFor, guideHtml, readingMinutes, formatGuideDate, relatedLabel } = await import(
    "@/utils/guides"
  );
  const g = guideFor(params.slug);
  if (!g) return { notFound: true };

  const related = g.related
    .map((path) => ({ path, name: relatedLabel(path) }))
    .filter((r) => r.name);
  const more = allGuides()
    .filter((x) => x.slug !== g.slug)
    .slice(0, 3)
    .map((x) => ({ slug: x.slug, h1: x.h1, description: x.description }));

  return {
    props: {
      guide: {
        slug: g.slug,
        title: g.title,
        description: g.description,
        h1: g.h1,
        date: g.date,
        updated: g.updated,
        dateLabel: formatGuideDate(g.date),
        updatedLabel: g.updated !== g.date ? formatGuideDate(g.updated) : null,
        minutes: readingMinutes(g),
        html: guideHtml(g),
      },
      related,
      more,
    },
  };
}

export default function GuidePage({ guide: g, related, more }) {
  const url = absoluteUrl(`/guides/${g.slug}`);
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    datePublished: g.date,
    dateModified: g.updated,
    mainEntityOfPage: url,
    url,
    image: ogImageUrl(),
    author: {
      "@type": "Person",
      name: "Mya",
      jobTitle: "Nail technician",
      worksFor: { "@id": `${siteUrl()}/#salon`, "@type": "NailSalon", name: SITE_NAME, url: siteUrl() },
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteUrl() },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Nail guides", item: absoluteUrl("/guides") },
      { "@type": "ListItem", position: 3, name: g.h1, item: url },
    ],
  };

  return (
    <main className="min-h-screen bg-stone-50">
      {/* bareTitle: guide titles are written to length already, and the
          " | Mya's Nails Baby" suffix would push most past ~65 characters. */}
      <Seo path={`/guides/${g.slug}`} title={g.title} bareTitle description={g.description} jsonLd={[article, crumbs]} />

      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="Home"><Logo className="h-14 w-auto" /></Link>
          <Link href="/#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition">Book</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-xs uppercase tracking-wider text-stone-500">
          <Link href="/guides" className="hover:text-rose-800">Nail guides</Link>
          <span aria-hidden> / </span>
          <span>{g.dateLabel}</span>
        </nav>

        <h1 className="text-4xl font-bold text-stone-900 mt-3 mb-3 leading-tight" style={sectionHeading}>{g.h1}</h1>
        <p className="text-stone-600 leading-relaxed">{g.description}</p>
        <p className="text-stone-500 text-sm mt-2">
          By Mya, nail tech · {g.minutes} min read
          {g.updatedLabel && <> · Updated {g.updatedLabel}</>}
        </p>

        <article
          className="guide-prose bg-white border border-stone-200 p-8 sm:p-12 mt-8"
          dangerouslySetInnerHTML={{ __html: g.html }}
        />

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-stone-900" style={sectionHeading}>Related</h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              {related.map((r) => (
                <li key={r.path}>
                  <Link href={`/${r.path}`} className="text-rose-800 underline underline-offset-4 hover:text-rose-900">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 text-center bg-white border border-stone-200 p-8">
          <p className="text-2xl text-stone-900" style={sectionHeading}>Ready for a fresh set?</p>
          <p className="text-stone-600 mt-2">
            Book online — a $20 deposit holds your time and comes off your total.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-8 py-3 text-sm font-medium tracking-wide transition">
              BOOK AN APPOINTMENT
            </Link>
            <Link href="/services" className="border border-stone-300 text-stone-700 hover:border-stone-900 px-8 py-3 text-sm font-medium tracking-wide transition">
              SEE PRICES
            </Link>
          </div>
        </div>

        {more.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-stone-900" style={sectionHeading}>More nail guides</h2>
            <ul className="mt-4 space-y-3">
              {more.map((m) => (
                <li key={m.slug}>
                  <Link href={`/guides/${m.slug}`} className="block bg-white border border-stone-200 p-4 hover:border-rose-800 transition">
                    <span className="text-lg text-stone-900" style={sectionHeading}>{m.h1}</span>
                    <p className="text-stone-500 text-sm mt-1">{m.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <style jsx global>{`
        .guide-prose { color: #44403c; line-height: 1.75; }
        .guide-prose h2 { font-family: Georgia, serif; font-size: 1.5rem; font-weight: 700; color: #1c1917; margin: 2.25rem 0 0.75rem; }
        .guide-prose h3 { font-weight: 600; font-size: 1.125rem; color: #1c1917; margin: 1.5rem 0 0.5rem; }
        .guide-prose p { margin: 0 0 1rem; }
        .guide-prose ul, .guide-prose ol { margin: 0 0 1rem 1.25rem; }
        .guide-prose ul { list-style: disc; }
        .guide-prose ol { list-style: decimal; }
        .guide-prose li { margin: 0.25rem 0; }
        .guide-prose a { color: #9f1239; text-decoration: underline; text-underline-offset: 3px; }
        .guide-prose strong { color: #1c1917; }
        .guide-prose table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 0.925rem; display: block; overflow-x: auto; }
        .guide-prose th, .guide-prose td { border-bottom: 1px solid #e7e5e4; padding: 0.6rem 0.75rem 0.6rem 0; text-align: left; vertical-align: top; }
        .guide-prose th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #78716c; }
        .guide-prose > *:first-child { margin-top: 0; }
      `}</style>
    </main>
  );
}
