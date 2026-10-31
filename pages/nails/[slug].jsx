import Link from "next/link";
import Seo from "@/components/Seo";
import Logo from "@/components/Logo";
import { studioFor } from "@/utils/location";
import { vegasParts } from "@/utils/time";
import { SERVICE_PAGES, servicePage, servicePath } from "@/utils/servicePages";
import { breadcrumbJsonLd, faqJsonLdFrom, salonJsonLd, serviceJsonLd } from "@/utils/seo";
import {
  ART_LEVELS,
  DEPOSIT_CENTS,
  LENGTH_OPTIONS,
  PEDI_FRENCH_CENTS,
  PEDICURES,
  SERVICES,
  formatPrice,
} from "@/utils/pricing";

/**
 * A landing page per service — see utils/servicePages.js for why, and for
 * what keeps them from being doorway pages.
 *
 * Static, regenerated hourly like /services, so the address flips on move
 * day with no deploy and the page is as fast as a page can be.
 */

const scriptHeading = { fontFamily: "'Great Vibes', cursive", color: "#1c1917" };
const sectionHeading = { fontFamily: "Georgia, serif" };

const LENGTH_LABELS = { "Small/Xtra Small": "Short" };

/** The typo'd legacy key is the same service misspelled — never advertise it. */
const pedicures = Object.entries(PEDICURES).filter(([n]) => !n.includes("pedciure"));

export async function getStaticPaths() {
  return { paths: SERVICE_PAGES.map((p) => ({ params: { slug: p.slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  if (!servicePage(params.slug)) return { notFound: true };
  return { props: { slug: params.slug, today: vegasParts().date }, revalidate: 3600 };
}

/** Where "Book" lands: the homepage form, with this service already picked. */
function bookHref(page) {
  if (!page.preselect) return "/#booking";
  const q = new URLSearchParams(page.preselect).toString();
  return `/?${q}#booking`;
}

function minCents(page) {
  if (page.services.length) {
    return Math.min(...page.services.map((k) => SERVICES[k].flat ?? SERVICES[k].lengths[0]));
  }
  if (page.pedicures) return Math.min(...pedicures.map(([, c]) => c));
  if (page.art) return ART_LEVELS["French Tips"];
  return null;
}

export default function ServicePage({ slug, today = "" }) {
  const page = servicePage(slug);
  const studio = studioFor(today);
  const path = servicePath(page);
  const others = SERVICE_PAGES.filter((p) => p.slug !== slug);
  const lengthPriced = page.services.filter((k) => SERVICES[k].lengths);
  const flatPriced = page.services.filter((k) => SERVICES[k].flat != null);

  return (
    <main className="min-h-screen bg-stone-50">
      <Seo
        path={path}
        bareTitle
        title={`${page.title} | Mya's Nails Baby`}
        description={page.description}
        jsonLd={[
          serviceJsonLd({ name: page.h1, description: page.description, path, minCents: minCents(page) }),
          faqJsonLdFrom(page.faq),
          breadcrumbJsonLd([["Home", "/"], ["Prices", "/services"], [page.short, path]]),
          salonJsonLd(today),
        ]}
      />

      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="Home"><Logo className="h-14 w-auto" /></Link>
          <Link href={bookHref(page)} className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition">BOOK NOW</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <nav aria-label="Breadcrumb" className="text-xs text-stone-400 mb-8">
          <Link href="/" className="hover:text-stone-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/services" className="hover:text-stone-700">Prices</Link>
          <span className="mx-2">/</span>
          <span className="text-stone-600">{page.short}</span>
        </nav>

        <h1 className="text-5xl sm:text-6xl text-stone-900 mb-6 leading-tight" style={scriptHeading}>{page.h1}</h1>
        <div className="space-y-4 text-lg text-stone-700 leading-relaxed">
          {page.intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <p className="mt-4 text-sm text-stone-500">
          By Mya at {studio.name ? `${studio.name}, ` : ""}{studio.street}, {studio.cityLine}. By appointment only.
        </p>

        <div className="mt-8">
          <Link href={bookHref(page)} className="inline-block bg-rose-800 hover:bg-rose-900 text-white px-10 py-3 font-medium transition text-sm tracking-wide active:scale-95">
            BOOK AN APPOINTMENT
          </Link>
        </div>

        {/* ── prices ── every figure read from utils/pricing.js */}
        <section className="mt-12 bg-white border border-stone-200 p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-stone-900 mb-1" style={sectionHeading}>Prices</h2>
          <p className="text-stone-500 text-sm mb-5">Starting prices. You see an estimate as you book, and Mya confirms your final price at your appointment.</p>

          {/* One service: a row per length, which reads fine on a phone.
              Two or more: a table, one column each. */}
          {lengthPriced.length === 1 && LENGTH_OPTIONS.map((l, i) => {
            const svc = SERVICES[lengthPriced[0]];
            return (
              <PriceRow key={l} label={LENGTH_LABELS[l] || l}
                value={`${formatPrice(svc.lengths[i])}${svc.openEnded && i === svc.lengths.length - 1 ? "+" : ""}`} />
            );
          })}
          {lengthPriced.length > 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                    <th className="pb-2 font-semibold">Length</th>
                    {lengthPriced.map((k) => (
                      <th key={k} className="pb-2 font-semibold text-right">{SERVICES[k].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LENGTH_OPTIONS.map((l, i) => (
                    <tr key={l} className="border-t border-stone-100">
                      <td className="py-2.5 text-stone-700">{LENGTH_LABELS[l] || l}</td>
                      {lengthPriced.map((k) => (
                        <td key={k} className="py-2.5 text-right text-stone-900 font-medium">
                          {formatPrice(SERVICES[k].lengths[i])}
                          {SERVICES[k].openEnded && i === SERVICES[k].lengths.length - 1 ? "+" : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {flatPriced.map((k) => (
            <PriceRow key={k} label={SERVICES[k].label} value={formatPrice(SERVICES[k].flat)} />
          ))}

          {page.pedicures && (
            <>
              {pedicures.map(([name, cents]) => <PriceRow key={name} label={name} value={formatPrice(cents)} />)}
              <PriceRow label="French tips add-on" value={`+${formatPrice(PEDI_FRENCH_CENTS)}`} />
            </>
          )}

          {(page.art || page.services.length > 0) && (
            <div className={page.art ? "" : "mt-6"}>
              {!page.art && <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-1">Nail art, added on top</p>}
              {Object.entries(ART_LEVELS)
                .filter(([, c]) => c > 0)
                .map(([name, cents]) => <PriceRow key={name} label={name} value={`from +${formatPrice(cents)}`} />)}
            </div>
          )}

          <p className="text-stone-500 text-sm mt-5">
            A {formatPrice(DEPOSIT_CENTS)} non-refundable deposit books your time and comes off your total.{" "}
            <Link href="/services" className="text-rose-800 underline hover:text-rose-900">See the full price list</Link>
          </p>
        </section>

        {/* ── good to know ── */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-stone-900 mb-4" style={sectionHeading}>Good to know</h2>
          <ul className="space-y-2.5 text-stone-700">
            {page.goodToKnow.map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-rose-800 flex-shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── questions ── the same text as the FAQ structured data */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-stone-900 mb-4" style={sectionHeading}>Questions</h2>
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {page.faq.map(([q, a]) => (
              <details key={q} className="group py-4" open>
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4 font-semibold text-stone-900">
                  <h3>{q}</h3>
                  <span className="text-rose-800 group-open:rotate-45 transition text-xl leading-none" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-stone-700 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 bg-white border border-stone-200 p-8 text-center">
          <p className="text-4xl text-stone-900 mb-4" style={scriptHeading}>Ready for your set?</p>
          <Link href={bookHref(page)} className="inline-block bg-rose-800 hover:bg-rose-900 text-white px-10 py-3 font-medium transition text-sm tracking-wide active:scale-95">
            BOOK AN APPOINTMENT
          </Link>
        </div>

        {/* ── the other services ── internal links, so every page is two
            clicks from every other and none of them is an orphan */}
        <nav className="mt-12" aria-label="Other services">
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">More from Mya</p>
          <ul className="flex flex-wrap gap-2">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={servicePath(p)} className="inline-block border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-4 py-2 text-sm transition">
                  {p.short}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-center text-stone-400 text-xs mt-12">
          <Link href="/" className="hover:text-stone-600 transition">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}

function PriceRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-stone-700">{label}</span>
      <span className="text-stone-900 font-medium whitespace-nowrap">{value}</span>
    </div>
  );
}
