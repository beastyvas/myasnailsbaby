import Link from "next/link";
import Seo from "@/components/Seo";
import Logo from "@/components/Logo";
import { MOVE_DATE, mapEmbedUrl, studioFor, studioPostal } from "@/utils/location";
import { vegasParts } from "@/utils/time";
import { CONTACT, DEPOSIT_DOLLARS, OPENING_HOURS, SERVICES, absoluteUrl, salonJsonLd } from "@/utils/seo";

/**
 * The Henderson landing page.
 *
 * Mya moved her studio from E. Flamingo Rd in Las Vegas to N Pecos Rd in
 * Henderson on MOVE_DATE. The homepage still speaks to all of Las Vegas —
 * that's where most of her existing clients found her — so this is the page
 * that answers "nail tech henderson" / "nails near me" for someone in
 * Henderson, and the page the SEO guides link to when they mention the area.
 *
 * EVERYTHING HERE IS A FACT FROM THE CODEBASE: the address and building from
 * utils/location.js, hours, services and contact details from utils/seo.js.
 * No invented landmarks, drive times, neighborhoods or reviews — a local page
 * full of made-up local colour is exactly what Google's spam policies call a
 * doorway page. The suite number stays private (see utils/location.js).
 */

const sectionHeading = { fontFamily: "Georgia, serif" };

export async function getStaticProps() {
  const { allGuides } = await import("@/utils/guides");
  return {
    props: {
      today: vegasParts().date,
      guides: allGuides()
        .slice(0, 3)
        .map((g) => ({ slug: g.slug, h1: g.h1, description: g.description })),
    },
    revalidate: 3600,
  };
}

const formatTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${suffix}` : `${hr}${suffix}`;
};

const moveLabel = (() => {
  const [y, mo, d] = MOVE_DATE.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
})();

export default function Henderson({ today = "", guides = [] }) {
  const studio = studioFor(today);
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Henderson, NV", item: absoluteUrl("/henderson") },
    ],
  };

  return (
    <main className="min-h-screen bg-stone-50">
      <Seo
        path="/henderson"
        title="Nail Tech in Henderson, NV — Gel-X, Acrylic & Structure Gel"
        bareTitle
        description="Mya's Nails Baby is a private nail studio on N Pecos Rd in Henderson, NV. Gel-X, acrylic, structure gel, hard gel, nail art and gel pedicures, by appointment."
        jsonLd={[salonJsonLd(today), crumbs]}
      />

      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="Home"><Logo className="h-14 w-auto" /></Link>
          <Link href="/#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition">Book</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-stone-900 mb-3" style={sectionHeading}>Nail tech in Henderson, NV</h1>
        <p className="text-stone-600 leading-relaxed max-w-2xl">
          I&apos;m Mya, and I do custom nail sets in a private suite
          {studio.name ? <> at {studio.name}</> : null} on {studio.area}. One client at a time, by
          appointment only — so you get my full attention and nobody&apos;s waiting on the next chair.
        </p>

        <div className="bg-white border border-stone-200 p-8 sm:p-12 mt-10 space-y-10">
          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>What I do</h2>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-stone-700 list-disc ml-5">
              {SERVICES.filter((s) => s !== "Builder Gel Manicure").map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="text-stone-600 mt-4">
              Starting prices for every set, length and art level are on the{" "}
              <Link href="/services" className="text-rose-800 underline underline-offset-4">price list</Link>.
              A ${DEPOSIT_DOLLARS} deposit holds your time and comes off your total.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>Where to find me</h2>
            <p className="text-stone-700">
              {studio.name && <>{studio.name}<br /></>}
              {studioPostal(studio)}
            </p>
            <p className="text-stone-500 text-sm mt-2">
              Your suite number comes in your confirmation text once you&apos;ve booked. No walk-ins.
            </p>
            <div className="mt-4 overflow-hidden border border-stone-200">
              <iframe
                title={`Map of ${studioPostal(studio)}`}
                src={mapEmbedUrl(studio)}
                width="100%"
                height="300"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>Hours</h2>
            <dl className="text-stone-700 space-y-1">
              {OPENING_HOURS.map(({ days, opens, closes }) => (
                <div key={days.join()} className="flex justify-between max-w-sm border-b border-stone-100 py-1.5">
                  <dt>{days.join(" & ")}</dt>
                  <dd>{formatTime(opens)} – {formatTime(closes)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-stone-500 text-sm mt-2">By appointment. Open slots are on the booking calendar.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>Moved from Las Vegas?</h2>
            <p className="text-stone-700 leading-relaxed">
              Yes — before {moveLabel} I was on E. Flamingo Rd in Las Vegas. Same Mya, same menu, same
              online booking; only the address changed. Questions? Text{" "}
              <a href={`sms:${CONTACT.phone}`} className="text-rose-800 underline underline-offset-4">{CONTACT.phoneDisplay}</a>{" "}
              or DM{" "}
              <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer" className="text-rose-800 underline underline-offset-4">@myasnailsbaby</a>.
            </p>
          </section>
        </div>

        <div className="mt-10 text-center">
          <Link href="/#booking" className="inline-block bg-rose-800 hover:bg-rose-900 text-white px-10 py-3 text-sm font-medium tracking-wide transition">
            BOOK AN APPOINTMENT
          </Link>
        </div>

        {guides.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-bold text-stone-900" style={sectionHeading}>Nail guides</h2>
            <ul className="mt-4 space-y-3">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="block bg-white border border-stone-200 p-4 hover:border-rose-800 transition">
                    <span className="text-lg text-stone-900" style={sectionHeading}>{g.h1}</span>
                    <p className="text-stone-500 text-sm mt-1">{g.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm"><Link href="/guides" className="text-rose-800 underline underline-offset-4">All guides</Link></p>
          </section>
        )}
      </div>
    </main>
  );
}
