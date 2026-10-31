/**
 * One landing page per service, for the searches people actually make:
 * "gel-x las vegas", "acrylic nails henderson", "builder gel near me".
 *
 * The homepage can only rank for one thing well (her name and "nail artist
 * las vegas"). A page per service is what gives Google something specific to
 * send each of those searches to.
 *
 * WHAT KEEPS THESE FROM BEING DOORWAY PAGES: each one is about a different
 * service, with its own prices, its own questions and its own advice. They
 * are not the same page with the city swapped — that pattern gets a site
 * demoted, and it is deliberately not done here (one city pair per service,
 * no /henderson-gel-x, /summerlin-gel-x clones).
 *
 * Facts only. Prices come from utils/pricing.js by key. Anything about
 * nails in general is phrased as "typically", because it varies by person;
 * anything about Mya's policy matches the homepage and the terms word for
 * word in substance. Nothing here promises a refund or a credit
 * (tests/policy.test.mjs reads this file).
 *
 * Browser-safe and dependency-free apart from pricing.
 */
import { ART_LEVELS, PEDI_FRENCH_CENTS, PEDICURES, REMOVALS, SERVICES, formatPrice } from "./pricing.js";

const from = (key) => {
  const s = SERVICES[key];
  return formatPrice(s.flat ?? s.lengths[0]);
};

/** `services` are keys of SERVICES, shown with their full price ladder.
 *  `preselect` is what the booking form starts with when they tap Book. */
export const SERVICE_PAGES = [
  {
    slug: "gel-x-las-vegas",
    short: "Gel-X",
    title: `Gel-X Nails in Las Vegas & Henderson — from ${from("Gel-X")}`,
    description: `Gel-X extensions by Mya, a Las Vegas nail artist with a private Henderson studio. Short to XXL, from ${from("Gel-X")}, with custom art. Book online with a $20 deposit.`,
    h1: "Gel-X Nails in Las Vegas",
    intro: [
      "Gel-X is a full-coverage soft gel tip, shaped and sized for each nail and bonded with gel. You get the length of an extension without the bulk, and it comes off with a soak instead of a drill.",
      "Mya does Gel-X in every length from short to XXL, plain or with hand-painted art, in a private suite in Henderson.",
    ],
    services: ["Gel-X"],
    preselect: { service: "Gel-X" },
    goodToKnow: [
      "Priced by length. Art and removal are added on top.",
      "Plan for about two hours in the chair.",
      "Gel-X typically lasts around three to four weeks, depending on your nails and how hard you are on your hands.",
      `Coming in with a set on? Removal of one of Mya's sets is +${formatPrice(REMOVALS["soak-off"])}, another salon's is +${formatPrice(REMOVALS.foreign)}.`,
    ],
    faq: [
      ["How much are Gel-X nails with Mya?", `Gel-X starts at ${from("Gel-X")} for short and goes up by length to ${formatPrice(SERVICES["Gel-X"].lengths[4])} for XXL. Nail art is added on top, from +${formatPrice(ART_LEVELS["Level 1"])}. You see an estimate as you book, and Mya confirms the final price at your appointment.`],
      ["Is Gel-X better than acrylic?", "It depends on what you want. Gel-X is lighter and more flexible and soaks off without heavy filing. Acrylic is harder and holds up to more wear, which suits very long or dramatic sets. Mya does both, so you can ask which suits your nails when you book."],
      ["Does Gel-X damage your natural nails?", "Gel-X is designed to come off with a soak, which is gentler than prying or heavy filing. Most damage comes from picking or peeling a set off at home, so book a removal instead."],
    ],
  },
  {
    slug: "acrylic-nails-las-vegas",
    short: "Acrylic & hard gel",
    title: `Acrylic Nails in Las Vegas & Henderson — from ${from("Acrylic")}`,
    description: `Custom acrylic and hard gel sets by Mya in Henderson, serving Las Vegas. Short to XXL, from ${from("Acrylic")}, with hand-painted nail art. Book online with a $20 deposit.`,
    h1: "Acrylic Nails in Las Vegas",
    intro: [
      "Acrylic is the strongest option for long, sculpted sets: a liquid and powder that hardens into a durable extension Mya shapes by hand. Hard gel with tips gives a similar strong result using gel instead.",
      "Both are priced the same, by length, from short through XXL.",
    ],
    services: ["Acrylic", "Hard Gel with Tips"],
    preselect: { service: "Acrylic" },
    goodToKnow: [
      "Priced by length. The longest sets are “+” because a very large custom set can run over.",
      "Plan for about two hours in the chair.",
      "Acrylic big toes can be added to a gel pedicure.",
      `Removal of another salon's set is +${formatPrice(REMOVALS.foreign)}.`,
    ],
    faq: [
      ["How much is a full set of acrylic nails?", `Acrylic starts at ${from("Acrylic")} for short and goes up by length; XXL is ${formatPrice(SERVICES.Acrylic.lengths[4])} and up. Art is added on top. You see an estimate as you book.`],
      ["What's the difference between acrylic and hard gel?", "Both make a strong, long-wearing extension. Acrylic is a liquid and powder; hard gel is a gel cured under a lamp and has no strong smell. Mya prices them the same."],
      ["Can I get long acrylic nails like XL or XXL?", "Yes. Mya does every length up to XXL. Send your inspo when you book so she can see the shape and design you want."],
    ],
  },
  {
    slug: "builder-gel-las-vegas",
    short: "Builder gel manicures",
    title: `Builder Gel Manicure in Las Vegas & Henderson — from ${from("Structure Gel Manicure")}`,
    description: `Structure gel (builder gel) manicures by Mya in Henderson, serving Las Vegas, from ${from("Structure Gel Manicure")}. Strength for your natural nails, no extensions.`,
    h1: "Builder Gel Manicures in Las Vegas",
    intro: [
      "Structure gel, also called builder gel, is a thicker gel built onto your natural nails to give them strength and a smooth, even shape. No tips or extensions, just your own nails, stronger.",
      "It's the one to pick if you want to grow your nails out, or if they bend and break easily. Mya also does regular gel manicures and hard gel manicures.",
    ],
    services: ["Structure Gel Manicure", "Gel Manicure", "Hard Gel Manicure", "Basic Manicure"],
    preselect: { service: "Structure Gel Manicure" },
    goodToKnow: [
      "One flat price, no length.",
      "Art can be added on top, from French tips to hand-painted designs.",
      "A good fit if your nails bend, peel or break before they get any length.",
    ],
    faq: [
      ["Is structure gel the same as builder gel?", "Yes. Mya calls it structure gel; you'll also see it called builder gel. It's the same service."],
      ["How much is a builder gel manicure?", `A structure gel manicure is ${from("Structure Gel Manicure")}. A regular gel manicure is ${from("Gel Manicure")} and a hard gel manicure is ${from("Hard Gel Manicure")}.`],
      ["Will builder gel help my nails grow?", "It protects your natural nails from bending and breaking, which is usually what stops them getting longer. It doesn't make them grow faster, but it helps them survive while they grow."],
    ],
  },
  {
    slug: "nail-art-las-vegas",
    short: "Custom nail art",
    title: "Custom Nail Art in Las Vegas & Henderson — Hand-Painted",
    description: `Hand-painted custom nail art by Mya in Henderson, serving Las Vegas. French tips from +${formatPrice(ART_LEVELS["French Tips"])}, designs from +${formatPrice(ART_LEVELS["Level 1"])}. Send your inspo when you book.`,
    h1: "Custom Nail Art in Las Vegas",
    intro: [
      "Art is where Mya's sets come alive: French tips and fully hand-painted designs on any Gel-X, acrylic or hard gel set, or a gel manicure.",
      "Bring a screenshot, a mood, or a color. Upload your inspo photos when you book and Mya will tell you which level it is before she starts, so the price is agreed up front.",
    ],
    services: [],
    art: true,
    preselect: null,
    goodToKnow: [
      "Art is added on top of the price of your set.",
      "The level is Mya's call from your design, not a fixed menu.",
      "Inspo photos upload straight into the booking form.",
    ],
    faq: [
      ["How much does nail art cost?", `French tips are +${formatPrice(ART_LEVELS["French Tips"])}. Designs run from Level 1 at +${formatPrice(ART_LEVELS["Level 1"])} to Level 4 at +${formatPrice(ART_LEVELS["Level 4"])}, depending on how detailed they are.`],
      ["Can I bring my own nail design?", "Yes, that's what most people do. Upload screenshots or saved pics in the booking form and Mya sees them with your appointment."],
      ["How do I know which art level my design is?", "Send your inspo when you book. Mya decides the level from your design and confirms it before she starts."],
    ],
  },
  {
    slug: "pedicure-las-vegas",
    short: "Gel pedicures",
    title: `Gel Pedicures in Las Vegas & Henderson — from ${formatPrice(PEDICURES["Gel pedicure"])}`,
    description: `Gel and acrylic pedicures by Mya in Henderson, serving Las Vegas, from ${formatPrice(PEDICURES["Gel pedicure"])}. Acrylic big toes and French tips available. Book on its own or with your nails.`,
    h1: "Gel Pedicures in Las Vegas",
    intro: [
      "Mya's pedicures are performed dry: no foot bath, just clean prep and a long-lasting gel or acrylic finish on your toes.",
      "Book one on its own or add it to a nail appointment in the same booking.",
    ],
    services: [],
    pedicures: true,
    preselect: { pedicure: "yes" },
    goodToKnow: [
      "Plan for about an hour, on top of any nail service you book with it.",
      `French tips can be added to any pedicure for +${formatPrice(PEDI_FRENCH_CENTS)}.`,
      "Acrylic big toes give a longer-lasting, more even finish on the toes that take the most wear.",
    ],
    faq: [
      ["How much is a gel pedicure?", `A gel pedicure is ${formatPrice(PEDICURES["Gel pedicure"])}, with acrylic big toes ${formatPrice(PEDICURES["Gel pedicure + Acrylic big toes"])}, and a full acrylic pedicure ${formatPrice(PEDICURES["Acrylic Pedicure"])}. French tips are +${formatPrice(PEDI_FRENCH_CENTS)}.`],
      ["What is a dry pedicure?", "A pedicure done without soaking your feet in a bath. Products adhere better to dry nails, and there's no shared tub."],
      ["Can I book nails and a pedicure together?", "Yes. Pick both in the booking form and they're booked as one appointment."],
    ],
  },
];

export function servicePage(slug) {
  return SERVICE_PAGES.find((p) => p.slug === slug) || null;
}

export function servicePath(p) {
  return `/nails/${p.slug}`;
}
