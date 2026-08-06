/** One source of truth for everything a search engine or a link preview
 *  needs to know about the business. Kept here rather than inline in pages
 *  so the address, hours and phone number can't drift apart across files. */

// Prices come from the same module the booking form prices against, so the
// numbers a crawler reads and the numbers a client is charged are the same
// numbers. pricing.js imports nothing, so there's no cycle here.
import { BOOKABLE_SERVICES, PEDICURES } from "./pricing";

export const SITE_NAME = "Mya's Nails Baby";
export const SITE_TAGLINE = "Nail Artist in Las Vegas";
export const DEPOSIT_DOLLARS = 20;

export const CONTACT = {
  phone: "+17029818428",
  phoneDisplay: "(702) 981-8428",
  email: "myasnailsbaby@gmail.com",
  instagram: "https://instagram.com/myasnailsbaby",
};

export const ADDRESS = {
  street: "2080 E. Flamingo Rd. Suite #106, Room 4",
  city: "Las Vegas",
  region: "NV",
  postalCode: "89119",
  country: "US",
  /** From the studio's map pin — lets Google place the business precisely. */
  latitude: 36.1136458,
  longitude: -115.1218948,
};

/** Matches the Studio Hours block on the homepage. Sun/Wed/Thu are closed
 *  and are simply absent — schema.org reads a missing day as closed. */
export const OPENING_HOURS = [
  { days: ["Monday", "Tuesday"], opens: "10:00", closes: "20:00" },
  { days: ["Friday"], opens: "08:00", closes: "18:00" },
  { days: ["Saturday"], opens: "08:00", closes: "16:00" },
];

/** The services on the booking form, as a catalog search engines can read.
 *
 *  "Builder Gel" stays alongside "Structure Gel" on purpose. Mya renamed the
 *  service, so every client-facing label says Structure Gel — but far more
 *  people type "builder gel las vegas" into Google than "structure gel", and
 *  this list is read by machines, not clients. Dropping the old term would
 *  give up the search traffic for a name change nobody is searching yet. */
export const SERVICES = [
  "Gel-X Extensions",
  "Gel Manicure",
  "Structure Gel Manicure",
  "Builder Gel Manicure",
  "Hard Gel with Tips",
  "Hard Gel Manicure",
  "Acrylic Nails",
  "Custom Nail Art",
  "Gel Pedicure",
];

export function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.myasnailsbaby.com");
  return raw.replace(/\/$/, "");
}

/** Absolute URL for a site-relative path — canonical tags and OG images are
 *  ignored by most crawlers unless they're absolute. */
export function absoluteUrl(path = "/") {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The link-preview card. Generated on the fly by /api/og so there's no
 *  binary asset to keep in sync with the branding. */
export function ogImageUrl() {
  return absoluteUrl("/api/og");
}

/**
 * Serialize a value for embedding in a <script type="application/ld+json">.
 *
 * JSON.stringify does not escape "<", so a value containing "</script>"
 * closes the tag early and everything after it becomes live HTML. Some of
 * what goes into this schema is editable from the dashboard, so escaping the
 * three characters that can start a tag or a comment is what keeps that
 * impossible. The escapes parse back to the original string, so the JSON
 * stays valid.
 */
export function jsonLdSafe(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** NailSalon is a recognized schema.org type and a more specific signal to
 *  Google than the generic LocalBusiness — it's what drives the map pack. */
export function salonJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    "@id": `${siteUrl()}/#salon`,
    name: SITE_NAME,
    description:
      "Custom nail sets by Mya in Las Vegas — Gel-X, acrylic, hard gel, structure gel and hand-painted nail art, plus gel pedicures. By appointment.",
    url: siteUrl(),
    image: ogImageUrl(),
    telephone: CONTACT.phone,
    email: CONTACT.email,
    priceRange: "$$",
    currenciesAccepted: "USD",
    paymentAccepted: "Credit Card",
    sameAs: [CONTACT.instagram],
    address: {
      "@type": "PostalAddress",
      streetAddress: ADDRESS.street,
      addressLocality: ADDRESS.city,
      addressRegion: ADDRESS.region,
      postalCode: ADDRESS.postalCode,
      addressCountry: ADDRESS.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: ADDRESS.latitude,
      longitude: ADDRESS.longitude,
    },
    areaServed: {
      "@type": "City",
      name: "Las Vegas",
      address: { "@type": "PostalAddress", addressRegion: "NV" },
    },
    openingHoursSpecification: OPENING_HOURS.map(({ days, opens, closes }) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days,
      opens,
      closes,
    })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Nail Services",
      itemListElement: SERVICES.map((name) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name, serviceType: name },
      })),
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        // #booking, not #book — the form's anchor is id="booking", and the
        // nav, hero CTA and Business Profile booking link all use it. This
        // was the only reference pointing somewhere that doesn't exist, and
        // it degraded silently to the top of the page instead of 404ing.
        urlTemplate: `${siteUrl()}/#booking`,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: { "@type": "Reservation", name: "Nail appointment" },
    },
  };
}

/**
 * The price list as structured data, for /services.
 *
 * `salonJsonLd` already emits an offer catalog, but a name-only one — Google
 * can see that Mya does Gel-X, not what it costs. Prices are what make a
 * service eligible for a rich result, and "gel-x price las vegas" is a
 * search someone makes with a card in their hand.
 *
 * Built from utils/pricing.js rather than a second hand-written list, so the
 * figures a crawler reads can never drift from the ones at checkout.
 * Length-priced sets are advertised from their shortest length, which is what
 * the page shows too.
 */
export function servicesJsonLd() {
  const offer = (name, cents) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name, serviceType: name },
    priceSpecification: {
      "@type": "PriceSpecification",
      price: (cents / 100).toFixed(2),
      priceCurrency: "USD",
      // Length-priced sets and open-ended top lengths both start here rather
      // than land here, and saying so is the honest version.
      valueAddedTaxIncluded: false,
    },
  });

  const items = [
    ...BOOKABLE_SERVICES.map((s) =>
      offer(s.label, s.flat != null ? s.flat : s.lengths[0])
    ),
    ...Object.entries(PEDICURES)
      // The typo'd legacy key is the same service under a misspelling —
      // publishing it would advertise a duplicate.
      .filter(([name]) => !name.includes("pedciure"))
      .map(([name, cents]) => offer(name, cents)),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${siteUrl()}/services#catalog`,
    name: `Nail Services & Prices — ${SITE_NAME}`,
    url: absoluteUrl("/services"),
    itemListElement: items,
  };
}

/** Questions people actually ask before booking. Eligible for the FAQ rich
 *  result, and answered from the policies already stated on the homepage. */
export function faqJsonLd() {
  const qa = [
    [
      "Do I need a deposit to book with Mya?",
      `Yes. Every appointment is secured with a $${DEPOSIT_DOLLARS} deposit, which goes toward the cost of your service. It is refundable if you cancel at least 48 hours before your appointment.`,
    ],
    [
      "Where is Mya's Nails Baby located?",
      `${ADDRESS.street}, ${ADDRESS.city}, ${ADDRESS.region} ${ADDRESS.postalCode}. Appointments only — please book online rather than walking in.`,
    ],
    [
      "What nail services does Mya offer?",
      `${SERVICES.slice(0, -1).join(", ")} and ${SERVICES[SERVICES.length - 1]}. Soak-off of existing sets, including work from another salon, can be added when you book.`,
    ],
    [
      "What happens if I am late to my nail appointment?",
      "Arriving more than 5 minutes late may mean a shortened service or a reschedule, and a $10 late fee applies. Message @myasnailsbaby as soon as you know you're running behind.",
    ],
    [
      "How do I cancel or reschedule my appointment?",
      "Use the reschedule or cancel link on the website with the phone number you booked with, or DM @myasnailsbaby. Cancellations at least 48 hours ahead have the deposit refunded.",
    ],
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}
