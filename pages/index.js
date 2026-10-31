"use client";

import confetti from "canvas-confetti";
import toast, { Toaster } from "react-hot-toast";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { loadStripe } from "@stripe/stripe-js";
import { v4 as uuidv4 } from "uuid";
import "react-calendar/dist/Calendar.css";
import Link from "next/link";
import dynamic from "next/dynamic";
import Seo from "@/components/Seo";
import NailGallery from "@/components/NailGallery";
import { InspoUploader } from "@/components/InspoPhotos";
import { encodeInspoPaths } from "@/utils/inspo";
import { faqJsonLd, salonJsonLd } from "@/utils/seo";
import { prettyDate, vegasParts } from "@/utils/time";
import { ART_LEVELS, BOOKABLE_SERVICES, PEDICURES, PEDI_FRENCH_CENTS, SERVICES, formatPrice, hasQuote, isLengthPriced, quote } from "@/utils/pricing";
import { CLIENT_CANCEL_ENABLED, PUBLIC_GALLERY_ENABLED } from "@/utils/features";
import { MOVE_DATE, NEW_STUDIO, OLD_STUDIO, mapEmbedUrl, studioFor } from "@/utils/location";
import Logo from "@/components/Logo";
import NailShape, { LENGTH_STEPS } from "@/components/NailShape";
import { getGoogleReviews } from "@/utils/reviews";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });
const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/**
 * Mya's portfolio, fetched on the server.
 *
 * It has to be server-rendered to be worth anything: the photos are the only
 * image content on the site, and a useEffect fetch would leave a crawler
 * looking at an empty div. This is also the page's first server-side data
 * fetch — everything else loads in the browser, which is fine for a booking
 * form and wrong for a portfolio.
 *
 * Service role, created here rather than imported: getServerSideProps is
 * stripped from the browser bundle, so the key never leaves the server. Using
 * the anon client would have made this depend on the gallery table's RLS
 * policy, and an empty portfolio would have looked like "she has no photos"
 * rather than "the read was refused".
 *
 * Never throws. A portfolio that fails to load costs a section; a
 * getServerSideProps that throws costs the entire homepage, booking form
 * included.
 */
export async function getServerSideProps() {
  // Today in Vegas, decided on the server so the Location section flips to
  // the new studio on move day by itself, and server and browser agree.
  const today = vegasParts().date;

  // Her Google rating and reviews. Null when the key isn't set or Google is
  // down, and then the section isn't drawn — see utils/reviews.js.
  const reviews = await getGoogleReviews();

  // Off by Mya's choice — don't pay for a query whose result nothing renders.
  if (!PUBLIC_GALLERY_ENABLED) return { props: { gallery: [], today, reviews } };

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await admin
      .from("gallery")
      .select("image_url, caption")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Homepage: couldn't load the gallery:", error.message);
      return { props: { gallery: [], today, reviews } };
    }
    return { props: { gallery: data || [], today, reviews } };
  } catch (err) {
    console.error("Homepage: gallery fetch threw:", err?.message || err);
    return { props: { gallery: [], today, reviews } };
  }
}

export default function Home({ gallery = [], today = "", reviews = null }) {
  const formRef = useRef();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [service, setService] = useState("");
  const [pedicure, setPedicure] = useState("no");
  const [duration, setDuration] = useState(0);
  const [soakoff, setSoakoff] = useState("");
  const [bioText, setBioText] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState(null);
  const [promoText, setPromoText] = useState("");
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [timeOptions, setTimeOptions] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [time, setTime] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [bookingNails, setBookingNails] = useState("no");
  const [pedicureType, setPedicureType] = useState("");
  const [pediFrench, setPediFrench] = useState(false);
  const [step, setStep] = useState(1);
  const [artLevel, setArtLevel] = useState("");
  const [nailLength, setNailLength] = useState("");
  const [inspoPaths, setInspoPaths] = useState([]);

  /**
   * The booking's id, minted on first use.
   *
   * Inspo photos are uploaded before checkout — the row doesn't exist yet, so
   * their storage paths have to be keyed to something, and this is the only
   * identifier available that early. It used to be created inside
   * handleSubmit, which is too late for an upload that happens while someone
   * is still filling in the form.
   *
   * A ref rather than state, and lazy rather than an initializer, so no uuid
   * is generated during server rendering — the server and the browser would
   * produce different ones.
   */
  const bookingIdRef = useRef(null);
  const bookingIdOnce = () => {
    if (!bookingIdRef.current) bookingIdRef.current = uuidv4();
    return bookingIdRef.current;
  };

  useEffect(() => {
    let d = 0;
    if (bookingNails === "yes") d += 2;
    if (pedicure === "yes") d += 1;
    setDuration(d);
  }, [bookingNails, pedicure]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("bio, profile_picture_url, promo_text, promo_enabled")
        .single();
      if (!error && data) {
        setBioText(data.bio || "");
        setProfilePicUrl(data.profile_picture_url || null);
        setPromoText(data.promo_text || "");
        setPromoEnabled(data.promo_enabled || false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const loadAvailableTimes = async () => {
      if (!selectedDate || !duration) return setTimeOptions([]);

      const { data: availabilityData, error: availErr } = await supabase
        .from("availability")
        .select("start_time, end_time")
        .eq("date", selectedDate)
        .single();

      if (availErr || !availabilityData) {
        console.error("No availability:", availErr);
        setTimeOptions([]);
        return;
      }

      const startHour = parseInt(availabilityData.start_time.split(":")[0]);
      const endHour = parseInt(availabilityData.end_time.split(":")[0]);

      const { data: booked, error: bookedErr } = await supabase
        .rpc("get_booked_slots", { p_date: selectedDate });

      if (bookedErr) {
        console.error("Booking RPC error:", bookedErr);
        return;
      }

      const bookedRanges = booked.map(({ start_time, end_time }) => {
        const [sh] = String(start_time).split(":");
        const [eh] = String(end_time).split(":");
        return { start: parseInt(sh, 10), end: parseInt(eh, 10) };
      });

      const now = new Date();
      const vegasNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
      const twentyFourHoursLater = new Date(vegasNow);
      twentyFourHoursLater.setHours(twentyFourHoursLater.getHours() + 24);
      const selectedDateTime = new Date(selectedDate + "T00:00:00");
      let minimumHour = startHour;
      const hoursDiff = (selectedDateTime - vegasNow) / (1000 * 60 * 60);
      if (hoursDiff < 24 && hoursDiff >= 0) {
        const requiredHour = twentyFourHoursLater.getHours();
        minimumHour = Math.max(requiredHour, startHour);
      }

      const available = [];
      for (let hour = minimumHour; hour <= endHour - duration; hour++) {
        const overlaps = bookedRanges.some(r => hour < r.end && (hour + duration) > r.start);
        if (!overlaps) available.push(`${String(hour).padStart(2, "0")}:00`);
      }
      setTimeOptions(available);
    };
    loadAvailableTimes();
  }, [selectedDate, duration]);

  useEffect(() => {
    const fetchAvailableDates = async () => {
      const { data, error } = await supabase.from("availability").select("date");
      if (error) { console.error("Failed to fetch available dates:", error.message); return; }

      // The Vegas date 24 hours from now. Derived straight from the instant
      // rather than by building a fake local Date and calling toISOString()
      // on it — that mixed a Vegas wall clock with a UTC conversion, and in
      // the evening it rolled the date forward and hid a bookable day.
      const minDateStr = vegasParts(new Date(Date.now() + 24 * 60 * 60 * 1000)).date;

      const validDates = data.map((d) => d.date).filter((date) => date >= minDateStr);
      setAvailableDates([...new Set(validDates)]);

      const pastDates = data.map((d) => d.date).filter((date) => date < minDateStr);
      if (pastDates.length > 0) {
        fetch("/api/cleanup-old-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: pastDates }),
        }).catch(err => console.error("Cleanup error:", err));
      }
    };
    fetchAvailableDates();
  }, []);

  function formatTo12Hour(timeStr) {
    const [hourStr] = timeStr.split(":");
    const hour = parseInt(hourStr);
    const suffix = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}${suffix}`;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const form = formRef.current;
    const data = new FormData(form);
    const name = data.get("name");
    const instagram = data.get("instagram");
    const phone = data.get("phone");
    const email = data.get("email");
    const service = data.get("service");
    const artLevel = data.get("artLevel");
    const date = data.get("date");
    const start_time = data.get("start_time");
    const length = data.get("Length");
    const notes = data.get("notes");
    const returning = data.get("returning");
    const referral = data.get("referral");
    const soakoff = data.get("soakoff");
    const pedicure = data.get("pedicure");
    const pedicureType = data.get("pedicureType") || "";
    // Only counts when a pedicure is actually being booked.
    const pedi_french = pedicure === "yes" && data.get("pediFrench") ? "yes" : "no";
    const bookingNails = data.get("bookingNails") || "no";
    // Same id the inspo photos were uploaded under, so their paths resolve.
    const bookingId = bookingIdOnce();
    const durationHours = duration;

    const payload = { id: bookingId, name, instagram, phone, service, artLevel, date, start_time, length, notes, returning, duration: durationHours, soakoff, referral, pedicure, pedicure_type: pedicureType, booking_nails: bookingNails, pedi_french, email };

    try {
      const res = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("Booking failed");

      const bookingMetadata = { booking_id: bookingId, name, instagram, phone, service, artLevel, date, start_time, length, notes, returning, pedicure_type: pedicureType, booking_nails: bookingNails, pedi_french, duration: durationHours, soakoff, referral, pedicure, email, inspo_urls: encodeInspoPaths(inspoPaths) };

      const stripeRes = await fetch("/api/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingMetadata }) });
      const stripeJson = await stripeRes.json();
      if (!stripeRes.ok) throw new Error(stripeJson.error || "Stripe checkout failed");

      toast.success("Booking confirmed! Redirecting to payment...", { duration: 2000, position: "bottom-center" });
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      window.location.href = stripeJson.url;
    } catch (err) {
      console.error("Error during booking:", err.message);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 placeholder-stone-400 bg-white";
  const selectCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 bg-white";
  const fieldLabel = "block text-sm font-medium text-stone-900 mb-2";

  // ── stepped booking form ───────────────────────────────────────────
  const STEPS = ["Service", "Date", "Your details"];

  const nailsChosen = bookingNails === "yes";
  const pedChosen = pedicure === "yes";

  // A step can only be left once everything it owns is filled, which is what
  // keeps the hidden steps' required fields valid at submit time — the
  // browser refuses to submit a form with an empty required field it can't
  // scroll to, and every field stays mounted so FormData still sees it.
  const step1Valid =
    (nailsChosen || pedChosen) &&
    (!nailsChosen || (service !== "" && soakoff !== "" && (!isLengthPriced(service) || nailLength !== ""))) &&
    (!pedChosen || pedicureType !== "");
  const step2Valid = !!selectedDate && !!time;
  const canAdvance = step === 1 ? step1Valid : step === 2 ? step2Valid : true;

  // One shared pricing function for the form, the server and the stored
  // quote, so what the client is shown can never drift from what's recorded.
  const priceQuote = quote({
    bookingNails, service, length: nailLength, artLevel, soakoff,
    pedicure, pedicureType, pediFrench,
  });
  const showPrice = hasQuote(priceQuote);

  const summaryService = [
    nailsChosen ? service : null,
    pedChosen ? `${pedicureType || "Pedicure"}${pediFrench ? " w/ french tips" : ""}` : null,
  ].filter(Boolean).join(" + ");
  const summaryDetails = [
    artLevel && artLevel !== "N/A" ? artLevel : null,
    nailLength && nailLength !== "N/A" ? nailLength : null,
    soakoff && soakoff !== "none" ? (soakoff === "foreign" ? "Foreign soak-off" : "Soak-off") : null,
  ].filter(Boolean).join(" · ");

  // Toggling one service shouldn't cost the duration the other one added —
  // same arithmetic the old select's onChange did, in one place.
  const setServiceAndDuration = (v) => {
    setService(v);
    if (!isLengthPriced(v)) setNailLength("");
    setDuration(v ? 2 + (pedicure === "yes" ? 1 : 0) : pedicure === "yes" ? 1 : 0);
  };

  const gelX = SERVICES["Gel-X"].lengths;
  const studio = studioFor(today);
  const moving = studio === OLD_STUDIO;

  return (
    <main className={`min-h-screen bg-stone-50${promoEnabled && promoText ? " pb-12" : ""}`}>
      <Seo
        path="/"
        bareTitle
        title="Mya's Nails Baby | Nail Artist in Las Vegas — Gel-X, Acrylic & Nail Art"
        description="Custom nail sets by Mya in Las Vegas. Gel-X, acrylic, hard gel, structure gel and hand-painted nail art, plus gel pedicures. Book online with a $20 deposit."
        jsonLd={[salonJsonLd(today), faqJsonLd(today)]}
      />
      <Toaster position="bottom-center" />

      {/* Promo Banner — fixed to bottom */}
      {promoEnabled && promoText && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-rose-800 text-white text-center text-sm font-medium px-4"
          style={{ padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {promoText}
        </div>
      )}

      {/* Sticky Header */}
      <header className="bg-white/90 backdrop-blur border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* A wordmark, not a heading — the page's one <h1> is in the hero. */}
          <span className="block">
            <Logo className="h-12 w-auto" />
          </span>
          <nav className="hidden sm:flex items-center gap-7 text-sm">
            {/* A real <Link> to /services, not an anchor — people want the
                prices before they decide to book, and it's the page's only
                internal link to it. */}
            <Link href="/services" className="text-stone-600 hover:text-rose-800">Prices</Link>
            <a href="#reviews" className={`text-stone-600 hover:text-rose-800${reviews ? "" : " hidden"}`}>Reviews</a>
            <a href="#policies" className="text-stone-600 hover:text-rose-800">Policies</a>
            <a href="#contact" className="text-stone-600 hover:text-rose-800">Visit</a>
          </nav>
          <a href="#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2.5 text-sm font-medium active:scale-95">
            Book now
          </a>
        </div>
      </header>

      {/* ── HERO ──
          No photos of her work (her call), so the hero is the thing every
          client asks first: how long, and what does that cost. */}
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid md:grid-cols-[1.15fr_1fr] gap-12 md:gap-10 items-end">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <img
                src={profilePicUrl
                  ? `https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicUrl}`
                  : "/images/mya.png"}
                alt="Mya - Las Vegas Nail Artist"
                className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow"
              />
              <p className="text-sm text-stone-600 leading-snug">
                Hi, I&apos;m Mya.<br />
                <span className="text-stone-500">Private studio, by appointment only</span>
              </p>
            </div>
            {/* The page's one <h1>: what she does and where, which is what
                someone searching "las vegas nail tech" is typing. */}
            <h1 className="font-display text-[2.75rem] leading-[1.02] sm:text-7xl sm:leading-[0.98] font-semibold text-stone-900 tracking-tight">
              Custom nail sets in Las Vegas, made for your hands.
            </h1>
            <p className="mt-6 text-lg text-stone-600 leading-relaxed max-w-md">
              {bioText || "Gel-X, acrylic, hard gel and hand-painted art. Book online with a $20 deposit that comes off your total."}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-8 py-3.5 font-medium active:scale-95">
                Book an appointment
              </a>
              <a
                href="https://instagram.com/myasnailsbaby"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-1 sm:px-4 py-3.5 text-stone-700 hover:text-rose-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z"/>
                </svg>
                @myasnailsbaby
              </a>
            </div>
          </div>

          {/* The length ladder. Prices read from utils/pricing.js, so this
              can't show a stale figure after she changes her list. */}
          <figure className="md:pl-8 md:border-l border-stone-200">
            <div className="flex items-end justify-between gap-2 max-w-sm" role="list" aria-label="Gel-X prices by length">
              {LENGTH_STEPS.map((l, i) => (
                <div key={l.value} role="listitem" className="flex flex-col items-center gap-3 nail-rise" style={{ animationDelay: `${i * 90}ms` }}>
                  <NailShape h={l.h * 1.25} w={34} />
                  <div className="text-center">
                    <p className="text-xs text-stone-500">{l.label}</p>
                    <p className="font-display text-xl font-semibold text-stone-900">{formatPrice(gelX[i])}</p>
                  </div>
                </div>
              ))}
            </div>
            <figcaption className="mt-6 text-sm text-stone-500 max-w-sm">
              Gel-X by length. Art and removal are added on top.{" "}
              <Link href="/services" className="text-rose-800 underline underline-offset-2 hover:text-rose-900">See every price</Link>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── HER WORK ──
          Off: she doesn't want a gallery on the site. See
          PUBLIC_GALLERY_ENABLED in utils/features.js for what that costs
          and how to bring it back. */}
      <div className="max-w-4xl mx-auto px-6">{PUBLIC_GALLERY_ENABLED && <NailGallery items={gallery} />}</div>

      {/* ── REVIEWS ──
          Straight from her Google Business Profile, only when it's
          configured and has reviews. Shown to people, never as structured
          data — see utils/reviews.js and tests/seo.test.mjs. */}
      {reviews && (
        <section id="reviews" className="bg-white border-y border-stone-200">
          <div className="max-w-5xl mx-auto px-6 py-14 grid md:grid-cols-[14rem_1fr] gap-10">
            <div>
              <p className="font-display text-7xl font-semibold text-stone-900 leading-none">{reviews.rating.toFixed(1)}</p>
              <Stars rating={reviews.rating} className="mt-3" />
              <p className="mt-3 text-sm text-stone-600">
                {reviews.count} {reviews.count === 1 ? "review" : "reviews"} on Google
              </p>
              {reviews.url && (
                <a href={reviews.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-rose-800 underline underline-offset-2 hover:text-rose-900">
                  Read them all on Google
                </a>
              )}
            </div>
            {reviews.reviews.length > 0 && (
              <ul className="flex md:grid md:grid-cols-2 gap-5 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0 pb-2">
                {reviews.reviews.slice(0, 4).map((r, i) => (
                  <li key={i} className="snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto bg-stone-50 border-l-2 border-rose-200 p-5">
                    <Stars rating={r.rating} small />
                    <p className="mt-3 text-[15px] text-stone-800 leading-relaxed line-clamp-6 whitespace-pre-line">{r.text}</p>
                    <p className="mt-4 text-sm text-stone-500">
                      {r.authorUrl
                        ? <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-stone-900 hover:text-rose-800">{r.author}</a>
                        : <span className="font-medium text-stone-900">{r.author}</span>}
                      {r.when && <>, {r.when}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ── BOOKING ── */}
      <section id="booking" className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div className="max-w-xl mb-10">
          <h2 className="font-display text-5xl font-semibold text-stone-900 tracking-tight">Book an appointment</h2>
          <p className="mt-3 text-stone-600">Pick your set, then a time. A $20 deposit holds it and comes off your total.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_18rem] gap-10 items-start">
          {/* Three steps rather than one long scroll. Every field stays
              mounted — hidden steps are display:none, not unmounted — so
              FormData still sees the whole form on submit and handleSubmit
              needs no changes at all. */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              // Enter on step 1 or 2 would submit a form whose later
              // required fields are still empty, which the browser rejects
              // with an unhelpful "not focusable" error. Advance instead.
              if (e.key === "Enter" && step < 3 && e.target.tagName !== "TEXTAREA") {
                e.preventDefault();
                if (canAdvance) setStep(step + 1);
              }
            }}
            className="bg-white border border-stone-200 p-6 sm:p-8 space-y-8"
          >
            {/* ── progress ─────────────────────────────────────────── */}
            <ol className="flex items-center gap-2" aria-label="Booking progress">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const done = step > n;
                const current = step === n;
                return (
                  <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                    <button
                      type="button"
                      onClick={() => { if (n < step) setStep(n); }}
                      disabled={n >= step}
                      aria-current={current ? "step" : undefined}
                      className="flex items-center gap-2 disabled:cursor-default"
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          current ? "bg-rose-800 text-white" : done ? "bg-rose-100 text-rose-800" : "bg-stone-100 text-stone-400"
                        }`}
                      >
                        {done ? "✓" : n}
                      </span>
                      <span className={`text-sm hidden sm:inline ${current ? "text-stone-900 font-medium" : "text-stone-400"}`}>
                        {label}
                      </span>
                    </button>
                    {n < STEPS.length && <span className="flex-1 h-px bg-stone-200" />}
                  </li>
                );
              })}
            </ol>

            {/* ── step 1 · services ────────────────────────────────── */}
            <div className={step === 1 ? "space-y-8" : "hidden"}>
              {/* Nails and pedicure are independent: either, or both. These
                  hidden inputs are what FormData reads. */}
              <input type="hidden" name="bookingNails" value={bookingNails} />
              <input type="hidden" name="pedicure" value={pedicure} />
              <fieldset>
                <legend className={fieldLabel}>What are you booking?</legend>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "nails", label: "Nails", sub: "Sets and manicures", on: nailsChosen,
                      toggle: () => { const v = nailsChosen ? "no" : "yes"; setBookingNails(v); if (v === "no") { setService(""); setSoakoff(""); setNailLength(""); } } },
                    { key: "pedi", label: "Pedicure", sub: "Gel or acrylic", on: pedChosen,
                      toggle: () => setPedicure(pedChosen ? "no" : "yes") },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={t.on}
                      onClick={t.toggle}
                      className={`text-left p-4 border ${t.on ? "border-rose-800 bg-nude" : "border-stone-300 hover:border-stone-500 bg-white"}`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-medium text-stone-900">{t.label}</span>
                        <span className={`w-5 h-5 border flex items-center justify-center text-xs ${t.on ? "bg-rose-800 border-rose-800 text-white" : "border-stone-300"}`}>{t.on ? "✓" : ""}</span>
                      </span>
                      <span className="block text-sm text-stone-500 mt-0.5">{t.sub}</span>
                    </button>
                  ))}
                </div>
                {!nailsChosen && !pedChosen && (
                  <p className="text-sm text-stone-500 mt-3">Pick nails, a pedicure, or both.</p>
                )}
              </fieldset>

              {nailsChosen && (
                <div className="space-y-8">
                  <fieldset>
                    <legend className={fieldLabel}>Service</legend>
                    {/* Order and prices both come from utils/pricing.js, so
                        the menu can't drift from the price list. */}
                    <div className="grid sm:grid-cols-2 gap-2">
                      {BOOKABLE_SERVICES.map((s) => (
                        <Choice key={s.value} name="service" value={s.value} checked={service === s.value}
                          onChange={() => setServiceAndDuration(s.value)} required>
                          <span className="font-medium text-stone-900">{s.label}</span>
                          <span className="text-sm text-stone-500">
                            {s.flat != null ? formatPrice(s.flat) : `from ${formatPrice(s.lengths[0])}`}
                          </span>
                        </Choice>
                      ))}
                    </div>
                  </fieldset>

                  {/* A manicure has no length and isn't priced by one —
                      showing the field there only invites a wrong answer. */}
                  <fieldset className={isLengthPriced(service) ? "" : "hidden"}>
                    <legend className={fieldLabel}>Length</legend>
                    <div className="grid grid-cols-5 gap-2">
                      {LENGTH_STEPS.map((l, i) => {
                        const on = nailLength === l.value;
                        return (
                          <label key={l.value} className={`relative cursor-pointer flex flex-col items-center justify-end gap-2 pt-3 pb-2.5 border ${on ? "border-rose-800 bg-nude" : "border-stone-200 hover:border-stone-400"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose-300`}>
                            <input type="radio" name="Length" value={l.value} checked={on}
                              onChange={() => setNailLength(l.value)} required={isLengthPriced(service)} className="sr-only" />
                            <NailShape h={l.h * 0.55} w={18} muted={!on} />
                            <span className="text-xs text-stone-700">{l.label}</span>
                            <span className="text-xs font-medium text-stone-900">
                              {isLengthPriced(service) ? formatPrice(SERVICES[service].lengths[i]) : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className={fieldLabel}>Nail art <span className="block font-normal text-stone-500 text-xs mt-0.5">Mya confirms the level from your inspo before she starts.</span></legend>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ART_LEVELS).map(([v, cents]) => (
                        <Chip key={v} name="artLevel" value={v} checked={artLevel === v} onChange={() => setArtLevel(v)}>
                          {v === "N/A" ? "None" : `${v} +${formatPrice(cents)}`}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className={fieldLabel}>Coming in with a set on?</legend>
                    <div className="flex flex-wrap gap-2">
                      <Chip name="soakoff" value="none" checked={soakoff === "none"} onChange={() => setSoakoff("none")} required>No, bare nails</Chip>
                      <Chip name="soakoff" value="soak-off" checked={soakoff === "soak-off"} onChange={() => setSoakoff("soak-off")}>Mya&apos;s set +$10</Chip>
                      <Chip name="soakoff" value="foreign" checked={soakoff === "foreign"} onChange={() => setSoakoff("foreign")}>Another salon&apos;s +$20</Chip>
                    </div>
                  </fieldset>
                </div>
              )}

              {pedChosen && (
                <fieldset>
                  <legend className={fieldLabel}>Pedicure</legend>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {["Gel pedicure", "Gel pedicure + Acrylic big toes", "Acrylic Pedicure"].map((v) => (
                      <Choice key={v} name="pedicureType" value={v} checked={pedicureType === v} onChange={() => setPedicureType(v)}>
                        <span className="font-medium text-stone-900">{v.replace("Gel pedicure + Acrylic big toes", "Gel + acrylic big toes").replace("Acrylic Pedicure", "Acrylic pedicure")}</span>
                        <span className="text-sm text-stone-500">{formatPrice(PEDICURES[v])}</span>
                      </Choice>
                    ))}
                  </div>
                  {/* Saved on the booking as pedi_french and shown on Mya's
                      dashboard, so she knows before they sit down. */}
                  <label className="flex items-start gap-3 cursor-pointer mt-4">
                    <input type="checkbox" name="pediFrench" checked={pediFrench}
                      onChange={(e) => setPediFrench(e.target.checked)}
                      className="mt-0.5 w-4 h-4 border-stone-300 accent-rose-800 flex-shrink-0" />
                    <span className="text-sm text-stone-700 leading-relaxed">
                      Add french tips <span className="text-stone-500">(+{formatPrice(PEDI_FRENCH_CENTS)})</span>
                    </span>
                  </label>
                </fieldset>
              )}

              {showPrice && (
                <div className="bg-nude px-5 py-4" aria-live="polite">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-stone-700">Estimated total</span>
                    <span className="font-display text-3xl font-semibold text-rose-900">
                      {priceQuote.isFrom ? "from " : ""}{formatPrice(priceQuote.total)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    $20 due now to book, {formatPrice(priceQuote.balanceCents)} at your appointment
                  </p>
                </div>
              )}
            </div>

            {/* ── step 2 · date & time ─────────────────────────────── */}
            <div className={step === 2 ? "space-y-6" : "hidden"}>
              <div>
                <p className={fieldLabel}>Day</p>
                <div className="calendar-wrapper">
                  <Calendar
                    value={selectedDate ? new Date(selectedDate + "T00:00:00") : null}
                    onChange={(date) => {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, "0");
                      const d = String(date.getDate()).padStart(2, "0");
                      setSelectedDate(`${y}-${m}-${d}`);
                      setTime("");
                    }}
                    tileDisabled={({ date }) => {
                      const iso = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
                      return !availableDates.includes(iso);
                    }}
                    tileClassName={({ date }) => {
                      const iso = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
                      return selectedDate === iso ? "selected-date-clean" : availableDates.includes(iso) ? "available-date-clean" : null;
                    }}
                    calendarType="US"
                    className="w-full"
                  />
                </div>
                <input type="hidden" name="date" value={selectedDate || ""} />
              </div>

              <fieldset>
                <legend className={fieldLabel}>
                  {selectedDate ? `Times on ${prettyDate(selectedDate)}` : "Time"}
                </legend>
                {!selectedDate && <p className="text-sm text-stone-500">Pick a day to see open times.</p>}
                {selectedDate && timeOptions.length === 0 && (
                  <p className="text-sm text-stone-500">No openings left that day. Try another date.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {timeOptions.map((t) => (
                    <Chip key={t} name="start_time" value={t} checked={time === t} onChange={() => setTime(t)} required>
                      {formatTo12Hour(t)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* ── step 3 · your details ────────────────────────────── */}
            <div className={step === 3 ? "space-y-8" : "hidden"}>

              {/* What they're about to pay for. Last chance to catch a
                  wrong date before Stripe takes the deposit. */}
              <div className="bg-nude p-5">
                <p className="font-display text-xl font-semibold text-stone-900 mb-3">Your appointment</p>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-600">Service</dt>
                    <dd className="text-stone-900 font-medium text-right">{summaryService || "—"}</dd>
                  </div>
                  {bookingNails === "yes" && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-600">Details</dt>
                      <dd className="text-stone-900 text-right">{summaryDetails || "—"}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-600">When</dt>
                    <dd className="text-stone-900 font-medium text-right">
                      {selectedDate && time ? `${prettyDate(selectedDate)} at ${formatTo12Hour(time)}` : "—"}
                    </dd>
                  </div>
                </dl>

                {showPrice && (
                  <div className="mt-4 pt-4 border-t border-rose-200/60">
                    <dl className="space-y-1.5 text-sm">
                      {priceQuote.lines.map((line, i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <dt className="text-stone-600">{line.label}</dt>
                          <dd className="text-stone-900">{formatPrice(line.cents)}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4 pt-2 mt-2 border-t border-rose-200/60">
                        <dt className="text-stone-900 font-semibold">Estimated total</dt>
                        <dd className="text-stone-900 font-semibold">
                          {priceQuote.isFrom ? "from " : ""}{formatPrice(priceQuote.total)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-stone-600">Deposit today</dt>
                        <dd className="text-rose-800 font-semibold">{formatPrice(priceQuote.depositCents)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-stone-600">Balance at your appointment</dt>
                        <dd className="text-stone-900">{formatPrice(priceQuote.balanceCents)}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                      An estimate — your final price is confirmed at your appointment.
                      {priceQuote.isFrom && " Very long or highly detailed sets can run a little over."}
                    </p>
                  </div>
                )}

                {!showPrice && (
                  <div className="flex justify-between gap-4 pt-2 mt-2 border-t border-rose-200/60 text-sm">
                    <span className="text-stone-600">Due now</span>
                    <span className="text-rose-800 font-semibold">$20 deposit</span>
                  </div>
                )}
                <button type="button" onClick={() => setStep(1)}
                  className="mt-3 text-sm text-rose-800 hover:text-rose-900 underline underline-offset-2">
                  Change something
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className={fieldLabel}>Full name</label>
                  <input id="name" type="text" name="name" required autoComplete="name" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="instagram" className={fieldLabel}>Instagram</label>
                  <input id="instagram" type="text" name="instagram" placeholder="@yourhandle" required className={inputCls} />
                </div>
                <div>
                  <label htmlFor="phone" className={fieldLabel}>Phone</label>
                  <input id="phone" type="tel" name="phone" placeholder="7021234567" required
                    pattern="\d{10}" inputMode="numeric" autoComplete="tel" title="Enter 10-digit phone number" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="email" className={fieldLabel}>Email</label>
                  <input id="email" type="email" name="email" required autoComplete="email" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="returning" className={fieldLabel}>Been to Mya before?</label>
                  <select id="returning" name="returning" required onChange={(e) => setIsReturning(e.target.value === "yes")} className={selectCls}>
                    <option value="">Choose</option>
                    <option value="yes">Yes</option>
                    <option value="no">No, first time</option>
                  </select>
                </div>
                {!isReturning && (
                  <div>
                    <label htmlFor="referral" className={fieldLabel}>Who referred you?</label>
                    <input id="referral" type="text" name="referral" required placeholder="A friend, Instagram, Google…" className={inputCls} />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="notes" className={fieldLabel}>Design ideas (optional)</label>
                  <textarea id="notes" name="notes" placeholder="Shape, colors, the vibe you're going for" rows="4"
                    className={`${inputCls} resize-none`} />
                </div>

                {/* Attached to the notes rather than given its own step —
                    a picture is how most people describe a set, so it
                    belongs with the words, not somewhere else. */}
                <InspoUploader
                  /* The getter, not the value — the uuid is minted on the
                     first upload, so nothing is generated during server
                     rendering. */
                  bookingId={bookingIdOnce}
                  paths={inspoPaths}
                  onChange={setInspoPaths}
                  label="Inspo photos (optional)"
                  hint="Screenshots or saved pics of the look you want — Mya sees these with your booking."
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name="confirmSMS" required className="mt-1 w-4 h-4 border-stone-300 accent-rose-800 flex-shrink-0" />
                  <span className="text-sm text-stone-700 leading-relaxed">
                    I agree to receive automated appointment-related text messages from Mya&apos;s Nails Baby (confirmations, reminders, updates) at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. I agree to the{" "}
                    <Link href="/terms" className="text-rose-800 underline hover:text-rose-900">Terms of Service</Link> and{" "}
                    <Link href="/privacy" className="text-rose-800 underline hover:text-rose-900">Privacy Policy</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name="confirmPolicy" required className="mt-1 w-4 h-4 border-stone-300 accent-rose-800 flex-shrink-0" />
                  <span className="text-sm text-stone-700">I understand a <strong>$20 deposit</strong> is required to confirm my booking, and I authorize Mya&apos;s Nails Baby to save my card on file and charge a <strong>$25 no-show fee</strong> if I miss my appointment without notice.</span>
                </label>
              </div>
            </div>

            {/* ── navigation ───────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-5 py-4 font-medium text-sm"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => canAdvance && setStep(step + 1)}
                  disabled={!canAdvance}
                  className={`flex-1 py-4 font-medium active:scale-[0.98] ${
                    canAdvance ? "bg-rose-800 hover:bg-rose-900 text-white" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  {step === 1 ? "Choose a date" : "Add your details"}
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting}
                  className={`flex-1 py-4 font-medium active:scale-[0.98] ${isSubmitting ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-rose-800 hover:bg-rose-900 text-white"}`}>
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      Booking…
                    </span>
                  ) : "Pay $20 deposit and book"}
                </button>
              )}
            </div>
          </form>

          {/* ── POLICIES ──
              Beside the form rather than in front of it: people read rules
              at the moment they commit, not before they've picked a set. */}
          <aside id="policies" className="lg:sticky lg:top-24 space-y-8 text-sm">
            <div>
              <h2 className="font-display text-2xl font-semibold text-stone-900 mb-4">Good to know</h2>
              <dl className="divide-y divide-stone-200 border-y border-stone-200">
                {[
                  // "avoid a cancellation fee" was vague and implied a refund
                  // existed at 48 hours. It doesn't — the deposit is never
                  // refunded. Saying it plainly avoids the conversation
                  // happening at the chair instead.
                  ["Deposit", "$20, non-refundable, and it comes off your total."],
                  ["Booking ahead", "At least 24 hours before your appointment."],
                  ["Running late", "Over 5 minutes may shorten your service or mean rescheduling. $10 late fee."],
                  ["Changing plans", "Reschedule online any time. To cancel, message Mya directly — at least 48 hours ahead so the slot can be filled."],
                ].map(([t, d]) => (
                  <div key={t} className="py-3">
                    <dt className="font-medium text-stone-900">{t}</dt>
                    <dd className="text-stone-600 mt-0.5 leading-relaxed">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">Before you come in</h2>
              <ul className="space-y-2 text-stone-700">
                {[
                  "Don't pick or cut your cuticles",
                  "Don't pick at or remove old product",
                  "Skip lotions, oils and hand cream that day",
                  "Keep nails out of water for 2 hours before",
                ].map((tip) => (
                  <li key={tip} className="flex gap-2.5">
                    <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-rose-800 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* ── VISIT ── */}
      <section id="contact" className="bg-white border-t border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-display text-5xl font-semibold text-stone-900 tracking-tight mb-6">Visit</h2>
            {/* Until move day it shows where she is now and says where she's
                going; from MOVE_DATE on, only the new suite. */}
            <address className="not-italic text-stone-700 leading-relaxed">
              {studio.name && <span className="block font-medium text-stone-900">{studio.name}</span>}
              {studio.street}<br />{studio.cityLine}
            </address>
            {moving && (
              <p className="mt-3 text-sm text-rose-800 font-medium">
                Moving {prettyDate(MOVE_DATE)}: {NEW_STUDIO.name}, {NEW_STUDIO.street}, {NEW_STUDIO.cityLine}.
                Appointments from then on are at the new suite.
              </p>
            )}

            <dl className="mt-8 grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-stone-500">Mon – Tue</dt><dd className="text-stone-900">10:00AM – 8:00PM</dd>
              <dt className="text-stone-500">Fri</dt><dd className="text-stone-900">8:00AM – 6:00PM</dd>
              <dt className="text-stone-500">Sat</dt><dd className="text-stone-900">8:00AM – 4:00PM</dd>
              <dt className="text-stone-500">Sun, Wed, Thu</dt><dd className="text-stone-500">Closed</dd>
            </dl>

            <ul className="mt-8 space-y-2 text-sm">
              <li><a href="tel:7029818428" className="text-stone-900 hover:text-rose-800 underline underline-offset-4 decoration-stone-300">(702) 981-8428</a></li>
              <li><a href="mailto:myasnailsbaby@gmail.com" className="text-stone-900 hover:text-rose-800 underline underline-offset-4 decoration-stone-300">myasnailsbaby@gmail.com</a></li>
              <li><a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-stone-900 hover:text-rose-800 underline underline-offset-4 decoration-stone-300">@myasnailsbaby</a></li>
            </ul>
          </div>
          <div className="border border-stone-200 overflow-hidden min-h-[320px] bg-stone-100">
            <iframe
              title="Map to the studio"
              src={mapEmbedUrl(studio)}
              width="100%" height="100%" style={{ border: 0, minHeight: 320 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div>
            <p className="text-4xl text-stone-900" style={{ fontFamily: "'Great Vibes', cursive" }}>Tag me in your nailfies!</p>
            <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-sm text-rose-800 hover:text-rose-900">
              @myasnailsbaby
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-500">
            <Link href="/terms" className="hover:text-stone-900">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-stone-900">Privacy Policy</Link>
            <Link href="/reschedule" className="hover:text-stone-900">Reschedule Appointment</Link>
            {/* Cancelling online is off: Mya would rather clients text her so
                she can handle the deposit case by case. Rescheduling stays. */}
            {CLIENT_CANCEL_ENABLED && (
              <>
                <Link href="/cancel-appointment" className="hover:text-stone-900">Cancel Appointment</Link>
              </>
            )}
            {/* No "Dashboard Login" link here. A link on the homepage is how
                Google found /login and showed it as a sitelink under her name
                in search. Mya gets to her dashboard from her bookmark:
                myasnailsbaby.com/login */}
          </div>
        </div>
      </footer>

      <style jsx global>{`
        /* The hero ladder grows in once, left to right. The only motion on
           the page that isn't a response to a tap. */
        .nail-rise {
          animation: nailRise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
          transform-origin: bottom;
        }
        @keyframes nailRise {
          from { opacity: 0; transform: translateY(14px) scaleY(0.9); }
          to { opacity: 1; transform: none; }
        }

        .calendar-wrapper .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
        }
        .calendar-wrapper .react-calendar__tile {
          border: 1px solid #fff !important;
          background: #fff !important;
          padding: 12px 0 !important;
          font-size: 14px;
          color: #a8a29e;
        }
        .calendar-wrapper .react-calendar__tile:hover:enabled {
          background: #f6ebe7 !important;
        }
        .calendar-wrapper .react-calendar__tile--now {
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .calendar-wrapper .available-date-clean {
          background: #fff !important;
          color: #1c1917 !important;
          font-weight: 600 !important;
          box-shadow: inset 0 0 0 1px #d6d3d1;
        }
        .calendar-wrapper .selected-date-clean {
          background: #9f1239 !important;
          color: white !important;
          font-weight: 600 !important;
        }
        .calendar-wrapper .react-calendar__tile:disabled {
          background: #fff !important;
          color: #d6d3d1 !important;
          cursor: default !important;
        }
        .calendar-wrapper .react-calendar__navigation {
          margin-bottom: 8px !important;
        }
        .calendar-wrapper .react-calendar__navigation button {
          color: #1c1917 !important;
          font-weight: 600 !important;
          font-size: 15px;
          background: transparent !important;
        }
        .calendar-wrapper .react-calendar__navigation button:disabled {
          color: #d6d3d1 !important;
        }
        .calendar-wrapper .react-calendar__month-view__weekdays {
          font-weight: 500 !important;
          color: #78716c !important;
          font-size: 12px;
          text-transform: none;
        }
        .calendar-wrapper .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none !important;
        }
      `}</style>
    </main>
  );
}

/** A big tappable option: a service, a pedicure. Real radio underneath. */
function Choice({ name, value, checked, onChange, required, children }) {
  return (
    <label className={`cursor-pointer flex items-center justify-between gap-3 px-4 py-3.5 border ${checked ? "border-rose-800 bg-nude" : "border-stone-200 hover:border-stone-400"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose-300`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} required={required} className="sr-only" />
      {children}
    </label>
  );
}

/** A small pill option: art level, removal, a time. Real radio underneath. */
function Chip({ name, value, checked, onChange, required, children }) {
  return (
    <label className={`cursor-pointer px-4 py-2 text-sm rounded-full border ${checked ? "border-rose-800 bg-rose-800 text-white" : "border-stone-300 text-stone-700 hover:border-stone-500 bg-white"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose-300 has-[:focus-visible]:ring-offset-1`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} required={required} className="sr-only" />
      {children}
    </label>
  );
}

function Stars({ rating, small = false, className = "" }) {
  const size = small ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <span className={`flex gap-0.5 ${className}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <svg key={i} viewBox="0 0 20 20" className={size} aria-hidden="true">
            <defs>
              <linearGradient id={`star-${i}-${Math.round(fill * 100)}`}>
                <stop offset={fill} stopColor="#9f1239" />
                <stop offset={fill} stopColor="#e7e5e4" />
              </linearGradient>
            </defs>
            <path fill={`url(#star-${i}-${Math.round(fill * 100)})`} d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
          </svg>
        );
      })}
    </span>
  );
}
