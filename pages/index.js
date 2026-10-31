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
import { SERVICE_PAGES, servicePath } from "@/utils/servicePages";
import NailShape, { LENGTH_STEPS } from "@/components/NailShape";
import { getGoogleReviews } from "@/utils/reviews";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });
const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/**
 * Her bio, photo and promo, read on the server.
 *
 * These used to load in the browser after the page arrived, so the HTML a
 * crawler (or a link preview) got had the placeholder bio, and her real
 * photo flickered in over the fallback. Same anon key and query the
 * browser used, so the table's RLS still applies. Null on any failure — the
 * browser then fetches them itself, as before.
 */
async function loadSettings() {
  try {
    // A plain server client, not the cookie-based browser one.
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
    const { data, error } = await anon
      .from("settings")
      .select("bio, profile_picture_url, promo_text, promo_enabled")
      .single();
    if (error || !data) return null;
    return {
      bio: data.bio || "",
      profilePic: data.profile_picture_url || null,
      promoText: data.promo_text || "",
      promoEnabled: !!data.promo_enabled,
    };
  } catch {
    return null;
  }
}

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
  // Both at once — neither should wait on the other.
  const [reviews, settings] = await Promise.all([getGoogleReviews(), loadSettings()]);

  // Off by Mya's choice — don't pay for a query whose result nothing renders.
  if (!PUBLIC_GALLERY_ENABLED) return { props: { gallery: [], today, reviews, settings } };

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
      return { props: { gallery: [], today, reviews, settings } };
    }
    return { props: { gallery: data || [], today, reviews, settings } };
  } catch (err) {
    console.error("Homepage: gallery fetch threw:", err?.message || err);
    return { props: { gallery: [], today, reviews, settings } };
  }
}

export default function Home({ gallery = [], today = "", reviews = null, settings = null }) {
  const formRef = useRef();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [service, setService] = useState("");
  const [pedicure, setPedicure] = useState("no");
  const [duration, setDuration] = useState(0);
  const [soakoff, setSoakoff] = useState("");
  const [bioText, setBioText] = useState(settings?.bio || "");
  const [profilePicUrl, setProfilePicUrl] = useState(settings?.profilePic || null);
  const [promoText, setPromoText] = useState(settings?.promoText || "");
  const [promoEnabled, setPromoEnabled] = useState(!!settings?.promoEnabled);
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

  // The service pages link here as /?service=Gel-X#booking, so someone who
  // tapped Book on the Gel-X page lands with Gel-X already picked. Only
  // values that exist in the price list are accepted.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const svc = q.get("service");
    if (svc && SERVICES[svc] && !SERVICES[svc].legacy) {
      setBookingNails("yes");
      setService(svc);
    }
    if (q.get("pedicure") === "yes") setPedicure("yes");
  }, []);

  useEffect(() => {
    let d = 0;
    if (bookingNails === "yes") d += 2;
    if (pedicure === "yes") d += 1;
    setDuration(d);
  }, [bookingNails, pedicure]);

  useEffect(() => {
    // Already rendered from the server; only fetch if that failed.
    if (settings) return;
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
  const sectionHeading = { fontFamily: "Georgia, serif" };
  const scriptHeading = { fontFamily: "'Great Vibes', cursive", color: "#1c1917" };
  const stepLabel = "text-xs font-semibold text-stone-500 uppercase tracking-wider";

  // Picking a service sets the appointment length, as the old dropdown did.
  const setServiceAndDuration = (v) => {
    setService(v);
    if (!isLengthPriced(v)) setNailLength("");
    setDuration(v ? 2 + (pedicure === "yes" ? 1 : 0) : pedicure === "yes" ? 1 : 0);
  };

  // ── stepped booking form ───────────────────────────────────────────
  const STEPS = ["Service", "Date", "Details"];

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

  return (
    <main className={`min-h-screen bg-stone-50${promoEnabled && promoText ? " pb-12" : ""}`}>
      <Seo
        path="/"
        bareTitle
        title="Mya's Nails Baby | Nail Artist in Las Vegas — Gel-X, Acrylic & Nail Art"
        description="Custom nail sets by Mya, a Las Vegas nail artist with a private studio in Henderson. Gel-X, acrylic, hard gel, builder gel and hand-painted nail art, plus gel pedicures. Book online with a $20 deposit."
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
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* A wordmark, not a heading. This used to be the page's <h1>,
              which spent the single strongest on-page signal there is on a
              word nobody searches for — and left the real heading below it
              as an <h2> under a logo. */}
          <span className="block">
            <Logo className="h-14 w-auto" />
          </span>
          <nav className="hidden sm:flex items-center space-x-6 text-sm">
            {/* A real <Link> to /services, not an anchor. Without an internal
                link the page is reachable only via the sitemap, which is a
                far weaker signal — and people want the prices before they
                decide to book anyway. */}
            <Link href="/services" className="text-stone-600 hover:text-stone-900 transition nav-slide">Prices</Link>
            <a href="#contact" className="text-stone-600 hover:text-stone-900 transition nav-slide">Contact</a>
            <a href="#policies" className="text-stone-600 hover:text-stone-900 transition nav-slide">Policies</a>
            <a href="#booking" className="text-stone-600 hover:text-stone-900 transition nav-slide">Book</a>
          </nav>
          <a href="#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition btn-shimmer active:scale-95">
            BOOK NOW
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6">

        {/* ── HERO ── */}
        <section className="py-16 text-center border-b border-stone-200">
          <div className="max-w-2xl mx-auto">
            {/* Rose-gold gradient ring frame */}
            <div
              className="mx-auto mb-8 hero-ring"
              style={{
                width: "fit-content",
                background: "linear-gradient(135deg, #9f1239 0%, #c9848c 35%, #e8b4b8 50%, #c9848c 65%, #9f1239 100%)",
                padding: "3px",
                borderRadius: "50%",
                boxShadow: "0 8px 32px rgba(159,18,57,0.20), 0 2px 8px rgba(201,132,140,0.30)",
              }}
            >
              <div style={{ background: "#fff", borderRadius: "50%", padding: "3px" }}>
                <img
                  src={profilePicUrl
                    ? `https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicUrl}`
                    : "/images/mya.webp"}
                  alt="Mya - Las Vegas Nail Artist"
                  width={208}
                  height={208}
                  fetchpriority="high"
                  className="w-44 h-44 sm:w-52 sm:h-52 object-cover block"
                  style={{ borderRadius: "50%" }}
                />
              </div>
            </div>
            {/* The page's one <h1>. "Your Nail Artist" said nothing about
                what she does or where — the two things somebody searching
                "las vegas nail tech" is actually typing. Same script face and
                placement, so it reads as it always did; slightly smaller at
                the mobile breakpoint because the line is longer now. */}
            <h1 className="text-5xl sm:text-7xl text-stone-900 mb-4" style={scriptHeading}>
              Your Las Vegas Nail Artist
            </h1>
            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
              {bioText || "Las Vegas based nail artist specializing in custom designs"}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-10 py-3 font-medium transition text-sm tracking-wide btn-shimmer active:scale-95">
                BOOK AN APPOINTMENT
              </a>
              <a
                href="https://instagram.com/myasnailsbaby"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-8 py-3 font-medium text-sm tracking-wide transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z"/>
                </svg>
                @myasnailsbaby
              </a>
            </div>
            {/* The three things people DM to ask before booking. */}
            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-stone-500">
              <li>Services from {formatPrice(Math.min(...BOOKABLE_SERVICES.map((s) => s.flat ?? s.lengths[0])))}</li>
              <li aria-hidden="true" className="w-1 h-1 rounded-full bg-[#c9848c]" />
              <li>$20 deposit to book</li>
              <li aria-hidden="true" className="w-1 h-1 rounded-full bg-[#c9848c]" />
              <li>By appointment only</li>
            </ul>
          </div>
        </section>

        {/* ── REVIEWS ──
            Straight from her Google Business Profile, only when it's
            configured and has reviews. Shown to people, never as structured
            data — see utils/reviews.js and tests/seo.test.mjs. */}
        {reviews && (
          <section id="reviews" className="py-14 border-b border-stone-200 text-center">
            <h3 className="text-5xl text-stone-900 mb-10 section-title-accent" style={scriptHeading}>Kind Words</h3>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-semibold text-stone-900">{reviews.rating.toFixed(1)}</span>
                <Stars rating={reviews.rating} />
              </div>
              <p className="text-sm text-stone-500">
                {reviews.count} {reviews.count === 1 ? "review" : "reviews"} on Google
                {reviews.url && (
                  <> · <a href={reviews.url} target="_blank" rel="noopener noreferrer" className="text-rose-800 underline hover:text-rose-900">Read them all</a></>
                )}
              </p>
            </div>
            {reviews.reviews.length > 0 && (
              <ul className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 sm:mx-0 sm:px-0 pb-2 text-left">
                {reviews.reviews.slice(0, 3).map((r, i) => (
                  <li key={i} className="snap-start shrink-0 w-[85%] sm:w-auto bg-white border border-stone-200 p-6 policy-card flex flex-col">
                    <span className="text-5xl leading-none text-[#c9848c] h-6" style={{ fontFamily: "Georgia, serif" }} aria-hidden="true">&ldquo;</span>
                    <p className="mt-2 text-sm text-stone-700 leading-relaxed line-clamp-6 whitespace-pre-line flex-1">{r.text}</p>
                    <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                      <p className="text-sm">
                        {r.authorUrl
                          ? <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-stone-900 hover:text-rose-800">{r.author}</a>
                          : <span className="font-semibold text-stone-900">{r.author}</span>}
                        {r.when && <span className="block text-xs text-stone-400">{r.when}</span>}
                      </p>
                      <Stars rating={r.rating} small />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── HER WORK ──
            Off: she doesn't want a gallery on the site. See
            PUBLIC_GALLERY_ENABLED in utils/features.js for what that costs
            and how to bring it back. Her dashboard Gallery tab still works,
            so anything she uploads meanwhile appears here if it's flipped on. */}
        {PUBLIC_GALLERY_ENABLED && <NailGallery items={gallery} />}

        {/* Policies then booking on wider screens, as it always was. On a
            phone the four policy cards are a long scroll before the form,
            so the form comes first there; the deposit and no-show terms
            are still agreed to in step 3 before anyone pays. */}
        <div className="flex flex-col">

        {/* ── BOOKING POLICIES ── */}
        <section id="policies" className="py-14 border-b border-stone-200 order-2 sm:order-1">
          <h3 className="text-5xl text-stone-900 text-center mb-12 section-title-accent" style={scriptHeading}>Booking Policies</h3>
          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            {[
              {
                icon: (
                  <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                ),
                title: "Appointments",
                body: "All appointments require a deposit to secure your spot and must be booked at least 24 hours in advance.",
              },
              {
                icon: (
                  <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                ),
                title: "Deposit",
                body: "A non-refundable $20 deposit is required at the time of booking to secure your appointment.",
              },
              {
                icon: (
                  <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                ),
                title: "Late Arrivals",
                body: "Arriving more than 5 minutes late may result in a shortened service or need to reschedule. $10 late fee applies.",
              },
              {
                icon: (
                  <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                ),
                title: "Cancellation",
                // "avoid a cancellation fee" was vague and implied a refund
                // existed at 48 hours. It doesn't — the deposit is never
                // refunded. Saying it plainly, together with the part that
                // makes it fair, avoids the conversation happening at the
                // chair instead.
                body: "Your $20 deposit is non-refundable. You can reschedule online any time; to cancel, message Mya directly — at least 48 hours ahead so the slot can be filled.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="bg-white border border-stone-200 p-6 policy-card card-lift">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-stone-100 flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <h4 className="font-semibold text-stone-900 text-sm uppercase tracking-wide">{title}</h4>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          {/* Before Your Appointment */}
          <div className="bg-white border-l-4 border-rose-800 shadow-lg p-8" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 1.5px 6px rgba(159,18,57,0.08)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-800 mb-1">Please Read</p>
            <h4 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: "Georgia, serif" }}>Before Your Appointment</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Avoid picking or cutting cuticles",
                "Avoid removing or picking at old product",
                "Avoid lotions, oils, and hand creams",
                "Avoid soaking nails in water at least 2 hrs before",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-3 text-sm text-stone-700">
                  <span className="w-5 h-5 rounded-full bg-rose-800 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">✕</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOOKING FORM ── */}
        <section id="booking" className="py-14 border-b border-stone-200 order-1 sm:order-2">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-5xl text-stone-900 text-center mb-12 section-title-accent" style={scriptHeading}>Book an Appointment</h3>

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
              className="bg-white border border-stone-200 p-6 sm:p-8 space-y-8 rg-top"
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
                        className={`flex items-center gap-2 text-left ${n < step ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <span
                          className={`w-7 h-7 flex items-center justify-center text-xs font-semibold flex-shrink-0 transition ${
                            current
                              ? "bg-rose-800 text-white"
                              : done
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-stone-100 text-stone-400 border border-stone-200"
                          }`}
                        >
                          {done ? "✓" : n}
                        </span>
                        <span className={`text-xs uppercase tracking-wider hidden sm:inline ${current ? "text-stone-900 font-semibold" : "text-stone-400"}`}>
                          {label}
                        </span>
                      </button>
                      {n < STEPS.length && <span className="flex-1 h-px bg-stone-200" />}
                    </li>
                  );
                })}
              </ol>

              {/* ── step 1 · services ────────────────────────────────── */}
              <div className={step === 1 ? "space-y-7" : "hidden"}>
                {/* Nails and pedicure are independent: either, or both. The
                    hidden inputs are what FormData reads on submit. */}
                <input type="hidden" name="bookingNails" value={bookingNails} />
                <input type="hidden" name="pedicure" value={pedicure} />
                <fieldset className="space-y-3">
                  <legend className={stepLabel}>What are you booking?</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "nails", label: "Nails", sub: "Sets & manicures", on: nailsChosen,
                        toggle: () => { const v = nailsChosen ? "no" : "yes"; setBookingNails(v); if (v === "no") { setService(""); setSoakoff(""); setNailLength(""); } } },
                      { key: "pedi", label: "Pedicure", sub: "Gel or acrylic", on: pedChosen,
                        toggle: () => setPedicure(pedChosen ? "no" : "yes") },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        aria-pressed={t.on}
                        onClick={t.toggle}
                        className={`choice-tile text-left p-4 border ${t.on ? "is-on" : ""}`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="font-semibold text-stone-900">{t.label}</span>
                          <span className={`w-5 h-5 border flex items-center justify-center text-[11px] ${t.on ? "bg-rose-800 border-rose-800 text-white" : "border-stone-300"}`}>{t.on ? "✓" : ""}</span>
                        </span>
                        <span className="block text-sm text-stone-500 mt-0.5">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                  {!nailsChosen && !pedChosen && (
                    <p className="text-sm text-stone-500">Pick nails, a pedicure, or both.</p>
                  )}
                </fieldset>

                {nailsChosen && (
                  <div className="space-y-7">
                    <fieldset className="space-y-3">
                      <legend className={stepLabel}>Service</legend>
                      {/* Order and prices both come from utils/pricing.js, so
                          the menu can't drift from the price list. */}
                      <div className="grid sm:grid-cols-2 gap-2">
                        {BOOKABLE_SERVICES.map((s) => (
                          <Choice key={s.value} name="service" value={s.value} checked={service === s.value}
                            onChange={() => setServiceAndDuration(s.value)} required>
                            <span className="text-stone-900">{s.label}</span>
                            <span className="text-sm text-stone-500 whitespace-nowrap">
                              {s.flat != null ? formatPrice(s.flat) : `from ${formatPrice(s.lengths[0])}`}
                            </span>
                          </Choice>
                        ))}
                      </div>
                    </fieldset>

                    {/* A manicure has no length and isn't priced by one —
                        showing the field there only invites a wrong answer. */}
                    <fieldset className={isLengthPriced(service) ? "space-y-3" : "hidden"}>
                      <legend className={stepLabel}>Length</legend>
                      <div className="grid grid-cols-5 gap-2">
                        {LENGTH_STEPS.map((l, i) => {
                          const on = nailLength === l.value;
                          return (
                            <label key={l.value} className={`choice-tile cursor-pointer flex flex-col items-center justify-end gap-1.5 pt-3 pb-2.5 border ${on ? "is-on" : ""}`}>
                              <input type="radio" name="Length" value={l.value} checked={on}
                                onChange={() => setNailLength(l.value)} required={isLengthPriced(service)} className="sr-only" />
                              <NailShape h={l.h * 0.55} w={18} muted={!on} />
                              <span className="text-xs text-stone-700 mt-1">{l.label}</span>
                              <span className="text-xs font-semibold text-stone-900">
                                {isLengthPriced(service) ? formatPrice(SERVICES[service].lengths[i]) : ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset className="space-y-3">
                      <legend className={stepLabel}>Nail art</legend>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ART_LEVELS).map(([v, cents]) => (
                          <Chip key={v} name="artLevel" value={v} checked={artLevel === v} onChange={() => setArtLevel(v)}>
                            {v === "N/A" ? "None" : `${v} +${formatPrice(cents)}`}
                          </Chip>
                        ))}
                      </div>
                      <p className="text-xs text-stone-500">Mya confirms the level from your inspo before she starts.</p>
                    </fieldset>

                    <fieldset className="space-y-3">
                      <legend className={stepLabel}>Removal</legend>
                      <div className="flex flex-wrap gap-2">
                        <Chip name="soakoff" value="none" checked={soakoff === "none"} onChange={() => setSoakoff("none")} required>No soak-off</Chip>
                        <Chip name="soakoff" value="soak-off" checked={soakoff === "soak-off"} onChange={() => setSoakoff("soak-off")}>Soak-off +$10</Chip>
                        <Chip name="soakoff" value="foreign" checked={soakoff === "foreign"} onChange={() => setSoakoff("foreign")}>Another salon&apos;s set +$20</Chip>
                      </div>
                    </fieldset>
                  </div>
                )}

                {pedChosen && (
                  <fieldset className="space-y-3">
                    <legend className={stepLabel}>Pedicure</legend>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {[
                        ["Gel pedicure", "Gel pedicure"],
                        ["Gel pedicure + Acrylic big toes", "Gel + acrylic big toes"],
                        ["Acrylic Pedicure", "Acrylic pedicure"],
                      ].map(([v, label]) => (
                        <Choice key={v} name="pedicureType" value={v} checked={pedicureType === v} onChange={() => setPedicureType(v)}>
                          <span className="text-stone-900">{label}</span>
                          <span className="text-sm text-stone-500">{formatPrice(PEDICURES[v])}</span>
                        </Choice>
                      ))}
                    </div>
                    {/* Saved on the booking as pedi_french and shown on Mya's
                        dashboard, so she knows before they sit down. */}
                    <label className="flex items-start gap-3 cursor-pointer pt-1">
                      <input type="checkbox" name="pediFrench" checked={pediFrench}
                        onChange={(e) => setPediFrench(e.target.checked)}
                        className="mt-0.5 w-4 h-4 border-stone-300 accent-rose-800 flex-shrink-0" />
                      <span className="text-sm text-stone-700 leading-relaxed">
                        Add <strong>french tips</strong> <span className="text-stone-500">(+{formatPrice(PEDI_FRENCH_CENTS)})</span>
                      </span>
                    </label>
                  </fieldset>
                )}

                {showPrice && (
                  <div className="estimate px-5 py-4" aria-live="polite">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
                        Estimated total
                      </span>
                      <span className="text-2xl font-bold text-rose-800">
                        {priceQuote.isFrom ? "from " : ""}{formatPrice(priceQuote.total)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                      $20 due now to book, {formatPrice(priceQuote.balanceCents)} at your appointment
                    </p>
                  </div>
                )}
              </div>

              {/* ── step 2 · date & time ─────────────────────────────── */}
              <div className={step === 2 ? "space-y-6" : "hidden"}>
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Date &amp; Time</h4>
                <div className="calendar-wrapper bg-white border border-stone-200 p-4">
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
                <fieldset className="space-y-3">
                  <legend className={stepLabel}>{selectedDate ? `Open times, ${prettyDate(selectedDate)}` : "Time"}</legend>
                  {!selectedDate && <p className="text-sm text-stone-500">Pick a day to see open times.</p>}
                  {selectedDate && timeOptions.length === 0 && (
                    <p className="text-sm text-stone-500">No openings left that day — try another date.</p>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeOptions.map((t) => (
                      <Chip key={t} name="start_time" value={t} checked={time === t} onChange={() => setTime(t)} required block>
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
                <div className="bg-stone-50 border border-stone-200 p-5">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Your Appointment</p>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Service</dt>
                      <dd className="text-stone-900 font-medium text-right">{summaryService || "—"}</dd>
                    </div>
                    {bookingNails === "yes" && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-stone-500">Details</dt>
                        <dd className="text-stone-900 text-right">{summaryDetails || "—"}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">When</dt>
                      <dd className="text-stone-900 font-medium text-right">
                        {selectedDate && time ? `${prettyDate(selectedDate)} at ${formatTo12Hour(time)}` : "—"}
                      </dd>
                    </div>
                  </dl>

                  {showPrice && (
                    <div className="mt-4 pt-4 border-t border-stone-200">
                      <dl className="space-y-1.5 text-sm">
                        {priceQuote.lines.map((line, i) => (
                          <div key={i} className="flex justify-between gap-4">
                            <dt className="text-stone-500">{line.label}</dt>
                            <dd className="text-stone-900">{formatPrice(line.cents)}</dd>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 pt-2 mt-2 border-t border-stone-200">
                          <dt className="text-stone-900 font-semibold">Estimated total</dt>
                          <dd className="text-stone-900 font-semibold">
                            {priceQuote.isFrom ? "from " : ""}{formatPrice(priceQuote.total)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-stone-500">Deposit today</dt>
                          <dd className="text-rose-800 font-semibold">{formatPrice(priceQuote.depositCents)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-stone-500">Balance at your appointment</dt>
                          <dd className="text-stone-900">{formatPrice(priceQuote.balanceCents)}</dd>
                        </div>
                      </dl>
                      <p className="text-xs text-stone-500 mt-3 leading-relaxed">
                        An estimate — your final price is confirmed at your appointment.
                        {priceQuote.isFrom && " Very long or highly detailed sets can run a little over."}
                      </p>
                    </div>
                  )}

                  {!showPrice && (
                    <div className="flex justify-between gap-4 pt-2 mt-2 border-t border-stone-200 text-sm">
                      <span className="text-stone-500">Due now</span>
                      <span className="text-rose-800 font-semibold">$20 deposit</span>
                    </div>
                  )}
                  <button type="button" onClick={() => setStep(1)}
                    className="mt-3 text-xs text-rose-800 hover:text-rose-900 underline">
                    Change something
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Personal Information</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="sr-only">Full name</label>
                      <input id="name" type="text" name="name" placeholder="Full Name" required autoComplete="name" className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="instagram" className="sr-only">Instagram handle</label>
                      <input id="instagram" type="text" name="instagram" placeholder="Instagram Handle" required className={inputCls} />
                    </div>
                  </div>
                  <label htmlFor="phone" className="sr-only">Phone number</label>
                  <input id="phone" type="tel" name="phone" placeholder="Phone Number (e.g. 7021234567)" required
                    pattern="\d{10}" inputMode="numeric" autoComplete="tel" title="Enter 10-digit phone number" className={inputCls} />
                  <label htmlFor="email" className="sr-only">Email address</label>
                  <input id="email" type="email" name="email" placeholder="Email Address (for confirmation)" required autoComplete="email" className={inputCls} />
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Additional Information</h4>
                  <label htmlFor="returning" className="sr-only">Returning client?</label>
                  <select id="returning" name="returning" required onChange={(e) => setIsReturning(e.target.value === "yes")} className={selectCls}>
                    <option value="">Returning client?</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  {!isReturning && (
                    <>
                      <label htmlFor="referral" className="sr-only">Who referred you?</label>
                      <input id="referral" type="text" name="referral" required placeholder="Who referred you?" className={inputCls} />
                    </>
                  )}
                  <label htmlFor="notes" className="sr-only">Design ideas or special requests</label>
                  <textarea id="notes" name="notes" placeholder="Design ideas or special requests" rows="4"
                    className={`${inputCls} resize-none`} />

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
                    className="border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-5 py-4 font-medium text-sm transition"
                  >
                    Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => canAdvance && setStep(step + 1)}
                    disabled={!canAdvance}
                    className={`flex-1 py-4 font-medium text-sm tracking-wide transition active:scale-95 ${
                      canAdvance ? "bg-rose-800 hover:bg-rose-900 text-white btn-shimmer" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    }`}
                  >
                    {step === 1 ? "CHOOSE A DATE" : "ADD YOUR DETAILS"}
                  </button>
                ) : (
                  <button type="submit" disabled={isSubmitting}
                    className={`flex-1 py-4 font-medium text-sm tracking-wide transition active:scale-95 ${isSubmitting ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-rose-800 hover:bg-rose-900 text-white btn-shimmer"}`}>
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                        Processing...
                      </span>
                    ) : "CONFIRM BOOKING"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        </div>

        {/* ── SERVICES ──
            A door into each service page. For people it's a quick "what
            does she do"; for Google it's the link that tells it those pages
            matter, from the page with the most authority on the site. */}
        <section id="services" className="py-14 border-b border-stone-200 text-center">
          <h3 className="text-5xl text-stone-900 mb-12 section-title-accent" style={scriptHeading}>What I Do</h3>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
            {SERVICE_PAGES.map((p) => (
              <li key={p.slug}>
                <Link href={servicePath(p)} className="block h-full bg-white border border-stone-200 p-6 policy-card group">
                  <span className="block font-semibold text-stone-900 text-sm uppercase tracking-wide">{p.short}</span>
                  <span className="block mt-2 text-sm text-stone-600 leading-relaxed">{p.intro[0].split(". ")[0]}.</span>
                  <span className="block mt-4 text-sm text-rose-800 group-hover:text-rose-900 underline underline-offset-2">Prices &amp; details</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── LOCATION ── */}
        <section className="py-14 border-b border-stone-200">
          <h3 className="text-5xl text-stone-900 text-center mb-6 section-title-accent" style={scriptHeading}>Location</h3>
          {(() => {
            // Until move day it shows where she is now and says where she's
            // going; from MOVE_DATE on, only the new suite.
            const studio = studioFor(today);
            const moving = studio === OLD_STUDIO;
            return (
              <>
                <p className="text-center text-stone-600 text-sm mb-2">
                  {[studio.name, studio.street, studio.cityLine].filter(Boolean).join(" · ")}
                </p>
                {moving && (
                  <p className="text-center text-rose-800 text-sm font-medium mb-2">
                    Moving {prettyDate(MOVE_DATE)}: {NEW_STUDIO.name}, {NEW_STUDIO.street}, {NEW_STUDIO.cityLine}.
                    Appointments from then on are at the new suite.
                  </p>
                )}
                <div className="mb-6" />
                <div className="border border-stone-200 overflow-hidden">
                  <iframe
                    title="Location"
                    src={mapEmbedUrl(studio)}
                    width="100%" height="360" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </>
            );
          })()}
        </section>

        {/* ── TAG ME ── */}
        <section className="py-14 text-center border-b border-stone-200">
          <p className="text-stone-500 text-sm uppercase tracking-widest mb-2">Love your set?</p>
          <h3 className="text-5xl text-stone-900 mb-3" style={scriptHeading}>Tag me in your nailfies!</h3>
          <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer"
            className="inline-block border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-6 py-2 text-sm font-medium transition mt-2">
            @myasnailsbaby
          </a>
        </section>

        {/* ── CONTACT DETAILS ── */}
        <section id="contact" className="py-14 border-b border-stone-200">
          <h3 className="text-5xl text-stone-900 text-center mb-12 section-title-accent" style={scriptHeading}>Contact Details</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Hours */}
            <div className="bg-white border border-stone-200 p-6 card-lift">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-rose-800 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Hours</p>
              </div>
              <div className="space-y-1.5 text-sm text-stone-700">
                <p><span className="font-semibold text-stone-900">Mon – Tue</span> · 10:00AM – 8:00PM</p>
                <p><span className="font-semibold text-stone-900">Fri</span> · 8:00AM – 6:00PM</p>
                <p><span className="font-semibold text-stone-900">Sat</span> · 8:00AM – 4:00PM</p>
                <p className="text-rose-800 font-medium pt-1">Sun / Wed / Thu — Closed</p>
              </div>
            </div>
            {/* Contact */}
            <div className="bg-white border border-stone-200 p-6 card-lift">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-rose-800 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M2.25 6.338c0-1.01.993-1.761 1.965-1.455l11.197 3.527a1.5 1.5 0 0 1 0 2.855L4.215 14.792C3.243 15.098 2.25 14.347 2.25 13.338V6.338z"/><path d="M2.25 12h19.5"/>
                </svg>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Contact</p>
              </div>
              <div className="space-y-3 text-sm">
                <a href="tel:7029818428" className="flex items-center gap-2.5 text-stone-700 hover:text-rose-800 transition contact-icon group">
                  <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-rose-800 transition flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.338c0 10.43 8.476 18.9 18.9 18.9.945 0 1.85-.693 1.85-1.64V16.81a1.5 1.5 0 0 0-1.195-1.47l-4.434-.883a1.5 1.5 0 0 0-1.537.677l-.93 1.544a.375.375 0 0 1-.437.163 13.526 13.526 0 0 1-7.516-7.516.375.375 0 0 1 .164-.437l1.544-.93a1.5 1.5 0 0 0 .678-1.537l-.883-4.434A1.5 1.5 0 0 0 7.63 2.25H3.977c-.946 0-1.728.846-1.728 1.838v2.25z"/>
                  </svg>
                  (702) 981-8428
                </a>
                <a href="mailto:myasnailsbaby@gmail.com" className="flex items-center gap-2.5 text-stone-700 hover:text-rose-800 transition contact-icon group">
                  <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-rose-800 transition flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
                  </svg>
                  myasnailsbaby@gmail.com
                </a>
                <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-700 hover:text-rose-800 transition contact-icon group">
                  <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-rose-800 transition flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z"/>
                  </svg>
                  @myasnailsbaby
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="py-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-400">
            <Link href="/terms" className="hover:text-stone-700 transition">Terms of Service</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-stone-700 transition">Privacy Policy</Link>
            <span>·</span>
            <Link href="/reschedule" className="hover:text-stone-700 transition">Reschedule Appointment</Link>
            {/* Cancelling online is off: Mya would rather clients text her so
                she can handle the deposit case by case. Rescheduling stays. */}
            {CLIENT_CANCEL_ENABLED && (
              <>
                <span>·</span>
                <Link href="/cancel-appointment" className="hover:text-stone-700 transition">Cancel Appointment</Link>
              </>
            )}
            {/* No "Dashboard Login" link here. A link on the homepage is how
                Google found /login and showed it as a sitelink under her name
                in search. Mya gets to her dashboard from her bookmark:
                myasnailsbaby.com/login */}
          </div>
        </footer>

      </div>

      {/* Calendar Styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');

        /* Rose-gold accent line under section headings */
        .section-title-accent {
          position: relative;
          display: inline-block;
        }
        .section-title-accent::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 72px;
          height: 1.5px;
          background: linear-gradient(90deg, transparent, #9f1239, #c9848c, #e8b4b8, #c9848c, #9f1239, transparent);
        }

        /* Standalone rose-gold divider line */
        .rg-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #c9848c 30%, #e8b4b8 50%, #c9848c 70%, transparent 100%);
          margin: 0;
          opacity: 0.6;
        }

        /* Soft blush glow behind her photo */
        .hero-ring {
          position: relative;
        }
        .hero-ring::before {
          content: '';
          position: absolute;
          inset: -40px;
          border-radius: 50%;
          background: radial-gradient(closest-side, rgba(232,180,184,0.35), transparent);
          z-index: -1;
        }

        /* The rose-gold line from the policy cards, kept on for the form */
        .rg-top {
          position: relative;
        }
        .rg-top::before {
          content: '';
          position: absolute;
          top: -1px;
          left: -1px;
          right: -1px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #9f1239, #c9848c, #e8b4b8, #c9848c, #9f1239, transparent);
        }

        /* Tappable booking choices */
        .choice-tile {
          border-color: #e7e5e4;
          background: #fff;
        }
        .choice-tile:hover {
          border-color: #c9848c;
        }
        .choice-tile.is-on {
          border-color: #9f1239;
          background: #fdf2f4;
          box-shadow: inset 0 0 0 1px #9f1239;
        }
        .choice-tile:has(:focus-visible),
        .choice-chip:has(:focus-visible) {
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px #c9848c;
        }
        .estimate {
          background: #fdf2f4;
          border: 1px solid #f5d0d6;
        }

        /* Card hover lift */
        .card-lift {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .card-lift:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(185,104,121,0.08);
          transform: translateY(-3px);
        }

        /* Policy card — rose-gold lift + gradient top accent on hover */
        .policy-card {
          position: relative;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
          overflow: hidden;
        }
        .policy-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #9f1239, #c9848c, #e8b4b8, #c9848c, #9f1239, transparent);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .policy-card:hover::before {
          opacity: 1;
        }
        .policy-card:hover {
          border-color: #c9848c;
          box-shadow: 0 10px 32px rgba(201,132,140,0.22), 0 2px 8px rgba(159,18,57,0.10);
          transform: translateY(-5px);
        }

        /* Button shimmer on hover */
        .btn-shimmer {
          position: relative;
          overflow: hidden;
        }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.4s ease;
        }
        .btn-shimmer:hover::after {
          left: 150%;
        }

        /* Nav link underline slide */
        .nav-slide {
          position: relative;
        }
        .nav-slide::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1px;
          background: #c9848c;
          transition: width 0.2s ease;
        }
        .nav-slide:hover::after {
          width: 100%;
        }

        /* Icon hover in contact cards */
        .contact-icon {
          transition: color 0.2s ease;
        }
        .contact-icon:hover {
          color: #9f1239 !important;
        }
        .calendar-wrapper .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
        }
        .calendar-wrapper .react-calendar__tile {
          border: 1px solid #e7e5e4 !important;
          background: white !important;
          padding: 12px !important;
          transition: all 0.15s !important;
          font-size: 13px;
          color: #57534e;
        }
        .calendar-wrapper .react-calendar__tile:hover:enabled {
          background: #fafaf9 !important;
          border-color: #78716c !important;
        }
        .calendar-wrapper .react-calendar__tile--now {
          background: #fafaf9 !important;
          font-weight: 600 !important;
        }
        .calendar-wrapper .available-date-clean {
          background: white !important;
          color: #1c1917 !important;
          font-weight: 700 !important;
          border-color: #78716c !important;
        }
        .calendar-wrapper .selected-date-clean {
          background: #9f1239 !important;
          color: white !important;
          font-weight: 700 !important;
          border-color: #9f1239 !important;
        }
        .calendar-wrapper .react-calendar__tile:disabled {
          background: #fafaf9 !important;
          color: #d6d3d1 !important;
          border-color: #f5f5f4 !important;
          cursor: default !important;
        }
        .calendar-wrapper .react-calendar__navigation {
          background: transparent !important;
          margin-bottom: 10px !important;
        }
        .calendar-wrapper .react-calendar__navigation button {
          color: #1c1917 !important;
          font-weight: 600 !important;
          font-size: 14px;
        }
        .calendar-wrapper .react-calendar__navigation button:hover {
          background: #fafaf9 !important;
        }
        .calendar-wrapper .react-calendar__month-view__weekdays {
          font-weight: 600 !important;
          color: #78716c !important;
          font-size: 11px;
          text-transform: uppercase;
        }
        .calendar-wrapper .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none !important;
        }
      `}</style>
    </main>
  );
}

/** A tappable option: a service, a pedicure. Real radio underneath. */
function Choice({ name, value, checked, onChange, required, children }) {
  return (
    <label className={`choice-tile cursor-pointer flex items-center justify-between gap-3 px-4 py-3.5 border text-sm ${checked ? "is-on" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} required={required} className="sr-only" />
      {children}
    </label>
  );
}

/** A small option: art level, removal, a time. Real radio underneath. */
function Chip({ name, value, checked, onChange, required, block = false, children }) {
  return (
    <label className={`choice-chip cursor-pointer px-4 py-2.5 text-sm border ${block ? "text-center" : ""} ${checked ? "bg-rose-800 border-rose-800 text-white" : "bg-white border-stone-300 text-stone-700 hover:border-[#c9848c]"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} required={required} className="sr-only" />
      {children}
    </label>
  );
}

function Stars({ rating, small = false }) {
  const size = small ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.round(Math.max(0, Math.min(1, rating - i)) * 100);
        const id = `star-${pct}`;
        return (
          <svg key={i} viewBox="0 0 20 20" className={size} aria-hidden="true">
            <defs>
              <linearGradient id={id}>
                <stop offset={`${pct}%`} stopColor="#9f1239" />
                <stop offset={`${pct}%`} stopColor="#e7e5e4" />
              </linearGradient>
            </defs>
            <path fill={`url(#${id})`} d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
          </svg>
        );
      })}
    </span>
  );
}
