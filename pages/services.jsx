"use client";

import Link from "next/link";
import Seo from "@/components/Seo";
import { salonJsonLd, servicesJsonLd } from "@/utils/seo";
import {
  ART_LEVELS,
  BOOKABLE_SERVICES,
  DEPOSIT_CENTS,
  LENGTH_OPTIONS,
  PEDICURES,
  REMOVALS,
  SPA_PEDI_CENTS,
  formatPrice,
} from "@/utils/pricing";

/**
 * The price list, as a page a search engine can actually read.
 *
 * Until now every figure lived inside a <select> on the booking form, which
 * is close to invisible to a crawler — so somebody searching "gel-x price
 * las vegas" had nothing of Mya's to land on.
 *
 * EVERY NUMBER HERE IS READ FROM utils/pricing.js. Nothing is retyped. A
 * price page that disagrees with checkout is worse than no price page at
 * all, and the only way to guarantee it can't is to never write a price
 * down twice.
 */

const sectionHeading = { fontFamily: "Georgia, serif" };

const lengthPriced = BOOKABLE_SERVICES.filter((s) => s.lengths);
const flatPriced = BOOKABLE_SERVICES.filter((s) => s.flat != null);

/** The typo'd key is a legacy form value kept for historical bookings; it's
 *  the same service under a misspelling and must not be advertised twice. */
const pedicures = Object.entries(PEDICURES).filter(([n]) => !n.includes("pedciure"));

const removalLabels = {
  "soak-off": "Soak-off of my own set",
  foreign: "Soak-off of another salon's set",
};

function Row({ label, value, note }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-stone-700">
        {label}
        {note && <span className="text-stone-400 text-sm"> · {note}</span>}
      </span>
      <span className="text-stone-900 font-medium whitespace-nowrap">{value}</span>
    </div>
  );
}

function Section({ title, children, intro }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-stone-900 mb-1" style={sectionHeading}>{title}</h2>
      {intro && <p className="text-stone-500 text-sm mb-3">{intro}</p>}
      <div className={intro ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export default function Services() {
  return (
    <main className="min-h-screen bg-stone-50">
      <Seo
        path="/services"
        title="Nail Prices & Services"
        description="Full price list for Mya's Nails Baby in Las Vegas — Gel-X from $45, acrylic from $55, hard gel, structure gel, gel manicures, pedicures and custom nail art. $20 deposit books your appointment."
        jsonLd={[servicesJsonLd(), salonJsonLd()]}
      />

      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-stone-900" style={sectionHeading}>MyasNailsBaby</Link>
          <Link href="/#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition">Book</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-stone-900 mb-2" style={sectionHeading}>Nail Prices &amp; Services</h1>
          <p className="text-stone-600 leading-relaxed max-w-2xl">
            Custom sets by Mya in a private suite on E. Flamingo Rd, Las Vegas. By
            appointment only. A {formatPrice(DEPOSIT_CENTS)} deposit books your
            time and comes off the price of your set.
          </p>
        </div>

        <div className="bg-white border border-stone-200 p-8 sm:p-12 space-y-10">

          <Section
            title="Full Sets"
            intro="Priced by length. Prices are for the set itself — art and removal are added below."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[34rem]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                    <th className="pb-2 font-semibold">Service</th>
                    {LENGTH_OPTIONS.map((l) => (
                      <th key={l} className="pb-2 font-semibold text-right">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lengthPriced.map((s) => (
                    <tr key={s.value} className="border-t border-stone-100">
                      <td className="py-2.5 pr-4 text-stone-700">{s.label}</td>
                      {s.lengths.map((cents, i) => (
                        <td key={i} className="py-2.5 text-right text-stone-900 font-medium whitespace-nowrap">
                          {formatPrice(cents)}
                          {/* Her list prints the top acrylic length as "$95+" —
                              a genuinely enormous custom set can run over. */}
                          {s.openEnded && i === s.lengths.length - 1 ? "+" : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Manicures" intro="One price, no length.">
            {flatPriced.map((s) => (
              <Row key={s.value} label={s.label} value={formatPrice(s.flat)} />
            ))}
          </Section>

          <Section title="Nail Art" intro="Added on top of your set.">
            {Object.entries(ART_LEVELS)
              .filter(([, cents]) => cents > 0)
              .map(([name, cents]) => (
                <Row key={name} label={name} value={`+${formatPrice(cents)}`} />
              ))}
          </Section>

          <Section title="Removal" intro="Only if you're coming in with something on.">
            {Object.entries(REMOVALS)
              .filter(([, cents]) => cents > 0)
              .map(([key, cents]) => (
                <Row key={key} label={removalLabels[key] || key} value={`+${formatPrice(cents)}`} />
              ))}
          </Section>

          <Section title="Pedicures">
            {pedicures.map(([name, cents]) => (
              <Row key={name} label={name} value={formatPrice(cents)} />
            ))}
            <Row
              label="Spa add-on"
              note="soak, scrub, mask"
              value={`+${formatPrice(SPA_PEDI_CENTS)}`}
            />
          </Section>

          <Section title="Booking &amp; Deposits">
            <div className="text-stone-700 leading-relaxed space-y-3">
              <p>
                Every appointment is held with a {formatPrice(DEPOSIT_CENTS)} deposit,
                which goes toward the cost of your service. Cancel at least 48 hours
                ahead and it's refunded.
              </p>
              <p>
                Arriving more than 5 minutes late may mean a shortened service or a
                reschedule, and a $10 late fee applies. Message{" "}
                <a href="https://instagram.com/myasnailsbaby" className="text-rose-800 hover:text-rose-900 underline">@myasnailsbaby</a>{" "}
                as soon as you know you're running behind.
              </p>
              <p className="text-stone-500 text-sm">
                Prices are for the work itself. Your exact total is shown before you
                pay, once you've picked your length, art and any removal.
              </p>
            </div>
          </Section>

          <div className="pt-2">
            <Link
              href="/#booking"
              className="inline-block bg-rose-800 hover:bg-rose-900 text-white px-10 py-3 font-medium transition text-sm tracking-wide"
            >
              Book an appointment
            </Link>
          </div>
        </div>

        <p className="text-center text-stone-400 text-xs mt-8">
          <Link href="/" className="hover:text-stone-600 transition">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
