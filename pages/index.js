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

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });
const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function Home() {
  const formRef = useRef();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [service, setService] = useState("");
  const [pedicure, setPedicure] = useState("");
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
  const [bookingNails, setBookingNails] = useState("");
  const [pedicureType, setPedicureType] = useState("");
  const [galleryItems, setGalleryItems] = useState([]);

  useEffect(() => {
    const fetchGallery = async () => {
      const { data, error } = await supabase
        .from("gallery")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      if (!error && data) setGalleryItems(data);
    };
    fetchGallery();
  }, []);

  // Scroll-reveal: fade/slide elements in as they enter the viewport
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    const observeAll = () => document.querySelectorAll("[data-reveal]:not(.in-view)").forEach((el) => io.observe(el));
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

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

      const now = new Date();
      const vegasNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
      const minBookableDate = new Date(vegasNow);
      minBookableDate.setHours(minBookableDate.getHours() + 24);
      const minDateStr = minBookableDate.toISOString().split("T")[0];

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
    const bookingNails = data.get("bookingNails") || "no";
    const bookingId = uuidv4();
    const durationHours = duration;

    const payload = { id: bookingId, name, instagram, phone, service, artLevel, date, start_time, length, notes, returning, duration: durationHours, soakoff, referral, pedicure, pedicure_type: pedicureType, booking_nails: bookingNails, email };

    try {
      const res = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("Booking failed");

      const bookingMetadata = { booking_id: bookingId, name, instagram, phone, service, artLevel, date, start_time, length, notes, returning, pedicure_type: pedicureType, booking_nails: bookingNails, duration: durationHours, soakoff, referral, pedicure, email };

      const stripeRes = await fetch("/api/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingMetadata }) });
      const stripeJson = await stripeRes.json();
      if (!stripeRes.ok) throw new Error(stripeJson.error || "Stripe checkout failed");

      toast.success("Booking confirmed! Redirecting to payment...", { duration: 2000, position: "bottom-center" });
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#B08D57", "#D4BC8B", "#F0E6CF", "#FFFFFF"] });
      window.location.href = stripeJson.url;
    } catch (err) {
      console.error("Error during booking:", err.message);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-4 py-3 border border-cream-300 focus:border-gold-600 focus:outline-none focus:ring-0 transition text-cream-900 placeholder-cream-400 bg-white";
  const selectCls = "w-full px-4 py-3 border border-cream-300 focus:border-gold-600 focus:outline-none focus:ring-0 transition text-cream-900 bg-white";
  const sectionHeading = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
  const scriptHeading = { fontFamily: "'Great Vibes', cursive", color: "#231D18" };
  const scriptHeadingGold = { fontFamily: "'Great Vibes', cursive", color: "#8F7440" };

  return (
    <main className={`min-h-screen bg-cream-50${promoEnabled && promoText ? " pb-12" : ""}`}>
      <Toaster position="bottom-center" toastOptions={{ style: { background: "#231D18", color: "#F0E6CF" } }} />

      {/* Promo Banner — fixed to bottom */}
      {promoEnabled && promoText && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-gold-700 text-white text-center text-sm font-medium px-4"
          style={{ padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {promoText}
        </div>
      )}

      {/* Announcement Bar */}
      <div className="bg-cream-900 text-center py-2 px-4">
        <p className="text-[11px] tracking-[0.3em] uppercase" style={{ color: "#F0E6CF" }}>
          Las Vegas · By Appointment Only
        </p>
      </div>

      {/* Sticky Header */}
      <header className="bg-cream-50/90 backdrop-blur-md border-b border-cream-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl text-cream-900 tracking-wide" style={sectionHeading}>
            Mya&apos;s Nails <span className="italic text-gold-700">Baby</span>
          </h1>
          <nav className="hidden sm:flex items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.2em]">
            <a href="#work" className="text-cream-600 hover:text-gold-700 transition nav-slide">Work</a>
            <a href="#policies" className="text-cream-600 hover:text-gold-700 transition nav-slide">Policies</a>
            <a href="#contact" className="text-cream-600 hover:text-gold-700 transition nav-slide">Contact</a>
          </nav>
          <a href="#booking" className="bg-cream-900 hover:bg-gold-700 text-white px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition btn-shimmer active:scale-95">
            Book Now
          </a>
        </div>
      </header>

      {/* ── HERO — full-bleed editorial ── */}
      <section className="relative overflow-hidden bg-cream-50">
        {/* Ghost script word */}
        <span className="hero-ghost" aria-hidden="true">Mya</span>

        <div className="max-w-6xl mx-auto px-6 relative min-h-[82vh] flex items-center py-16 sm:py-20">
          <div className="grid sm:grid-cols-[1.2fr_1fr] gap-12 sm:gap-16 items-center w-full">
            {/* Left: statement */}
            <div className="text-center sm:text-left order-2 sm:order-1">
              <p className="hero-rise hero-d1 text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-700 mb-6">
                Las Vegas Nail Artistry
              </p>
              <h2 className="hero-rise hero-d2 text-6xl sm:text-7xl lg:text-8xl text-cream-900 leading-[0.95] mb-5" style={sectionHeading}>
                Beautiful nails,
                <span className="block mt-3 text-gold-700 text-5xl sm:text-6xl lg:text-7xl" style={scriptHeadingGold}>made just for you</span>
              </h2>
              <p className="hero-rise hero-d3 text-base sm:text-lg text-cream-600 mb-10 leading-relaxed max-w-md mx-auto sm:mx-0">
                {bioText || "Las Vegas based nail artist specializing in custom designs"}
              </p>
              <div className="hero-rise hero-d4 flex flex-col sm:flex-row items-center gap-4">
                <a href="#booking" className="btn-lift w-full sm:w-auto text-center bg-gold-700 hover:bg-gold-800 text-white px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] transition btn-shimmer">
                  Book an Appointment
                </a>
                <a
                  href="https://instagram.com/myasnailsbaby"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-cream-700 hover:text-gold-700 px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] transition nav-slide"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z"/>
                  </svg>
                  @myasnailsbaby
                </a>
              </div>
              {/* Trust row */}
              <div className="hero-rise hero-d5 mt-12 pt-8 border-t border-cream-200 flex items-center justify-center sm:justify-start gap-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-cream-500">
                <span>Custom Designs</span>
                <span className="w-1 h-1 rounded-full bg-gold-400" />
                <span>Secure Booking</span>
                <span className="w-1 h-1 rounded-full bg-gold-400" />
                <span>By Appointment</span>
              </div>
            </div>

            {/* Right: arch portrait + rotating stamp */}
            <div className="order-1 sm:order-2 flex justify-center hero-rise hero-d2">
              <div className="relative">
                {/* offset gold frame */}
                <div className="absolute -top-4 -right-4 w-full h-full arch-frame border border-gold-400" aria-hidden="true" />
                <div
                  className="arch-frame overflow-hidden relative"
                  style={{
                    background: "linear-gradient(135deg, #8F7440 0%, #B08D57 35%, #F0E6CF 50%, #B08D57 65%, #8F7440 100%)",
                    padding: "3px",
                    boxShadow: "0 24px 64px rgba(143,116,64,0.22), 0 4px 16px rgba(212,188,139,0.25)",
                  }}
                >
                  <img
                    src={profilePicUrl
                      ? `https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicUrl}`
                      : "/images/mya.png"}
                    alt="Mya - Las Vegas Nail Artist"
                    className="w-64 h-80 sm:w-72 sm:h-96 object-cover block arch-frame"
                  />
                </div>
                {/* Rotating stamp */}
                <div className="stamp-spin absolute -bottom-8 -left-10 w-28 h-28 hidden sm:block" aria-hidden="true">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <defs>
                      <path id="stampCircle" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
                    </defs>
                    <circle cx="50" cy="50" r="49" fill="#FAF7F1" stroke="#D4BC8B" strokeWidth="1" />
                    <circle cx="50" cy="50" r="28" fill="none" stroke="#D4BC8B" strokeWidth="0.75" />
                    <text style={{ fontSize: "10.5px", letterSpacing: "2.5px", fill: "#8F7440", fontFamily: "Outfit, sans-serif", fontWeight: 600 }}>
                      <textPath href="#stampCircle">MYA&apos;S NAILS BABY · LAS VEGAS ·</textPath>
                    </text>
                    <text x="50" y="57" textAnchor="middle" style={{ fontSize: "20px", fill: "#B08D57", fontFamily: "'Great Vibes', cursive" }}>M</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2" aria-hidden="true">
          <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-cream-400">Scroll</span>
          <span className="scroll-cue-line" />
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="bg-white border-y border-cream-200 overflow-hidden py-5 select-none" aria-hidden="true">
        <div className="marquee-track whitespace-nowrap">
          {[0, 1].map((i) => (
            <span key={i} className="inline-block text-2xl sm:text-3xl italic text-cream-300 tracking-wide" style={sectionHeading}>
              Custom Sets <span className="text-gold-400 not-italic mx-4">✦</span> Gel-X <span className="text-gold-400 not-italic mx-4">✦</span> Acrylic <span className="text-gold-400 not-italic mx-4">✦</span> Hard Gel <span className="text-gold-400 not-italic mx-4">✦</span> Nail Art <span className="text-gold-400 not-italic mx-4">✦</span> Pedicures <span className="text-gold-400 not-italic mx-4">✦</span> Las Vegas <span className="text-gold-400 not-italic mx-4">✦</span>{" "}
            </span>
          ))}
        </div>
      </div>

      <div>

        {/* ── RECENT WORK — white band, asymmetric grid ── */}
        {galleryItems.length > 0 && (
          <section id="work" className="bg-white py-20 sm:py-28">
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex items-end justify-between mb-12" data-reveal>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-700 mb-3">01 — The Portfolio</p>
                  <h3 className="text-5xl sm:text-6xl text-cream-900" style={sectionHeading}>Recent <span className="italic text-gold-700">Work</span></h3>
                </div>
                <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer"
                  className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.2em] text-cream-600 hover:text-gold-700 transition nav-slide">
                  View More on Instagram
                </a>
              </div>

              {/* Desktop: asymmetric editorial grid */}
              <div className="hidden sm:grid grid-cols-3 gap-4 auto-rows-[260px]">
                {galleryItems.map((item, i) => (
                  <div
                    key={item.id}
                    data-reveal
                    style={{ transitionDelay: `${(i % 3) * 90}ms` }}
                    className={`group relative overflow-hidden bg-cream-100 ${i === 0 ? "row-span-2" : ""} ${i === 3 ? "col-span-2" : ""}`}
                  >
                    <img
                      src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${item.image_url}`}
                      alt={item.caption || "Nail design"}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                      loading="lazy"
                    />
                    {item.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cream-900/75 to-transparent px-5 pt-10 pb-4 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400">
                        <p className="text-white text-base italic" style={sectionHeading}>{item.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Mobile: horizontal snap scroll */}
              <div className="sm:hidden -mx-6 px-6 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide" data-reveal>
                {galleryItems.map((item) => (
                  <div key={item.id} className="snap-center flex-shrink-0 w-[75vw] relative overflow-hidden bg-cream-100">
                    <img
                      src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${item.image_url}`}
                      alt={item.caption || "Nail design"}
                      className="w-full aspect-[4/5] object-cover"
                      loading="lazy"
                    />
                    {item.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cream-900/75 to-transparent px-4 pt-8 pb-3">
                        <p className="text-white text-sm italic" style={sectionHeading}>{item.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── BOOKING POLICIES — ivory, offset editorial ── */}
        <section id="policies" className="bg-cream-50 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid sm:grid-cols-[1fr_2fr] gap-10 sm:gap-16">
              <div data-reveal>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-700 mb-3">02 — The Fine Print</p>
                <h3 className="text-5xl sm:text-6xl text-cream-900 leading-tight" style={sectionHeading}>
                  Booking<br /><span className="italic text-gold-700">Policies</span>
                </h3>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-12 gap-y-12">
                {[
                  {
                    num: "01",
                    title: "Appointments",
                    body: "All appointments require a deposit to secure your spot and must be booked at least 24 hours in advance.",
                  },
                  {
                    num: "02",
                    title: "Deposit",
                    body: "A non-refundable $20 deposit is required at the time of booking to secure your appointment.",
                  },
                  {
                    num: "03",
                    title: "Late Arrivals",
                    body: "Arriving more than 5 minutes late may result in a shortened service or need to reschedule. $10 late fee applies.",
                  },
                  {
                    num: "04",
                    title: "Cancellation",
                    body: "Cancellations must be made at least 48 hours in advance to avoid a cancellation fee.",
                  },
                ].map(({ num, title, body }, i) => (
                  <div key={title} className="flex gap-5" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                    <span className="text-5xl leading-none text-gold-400 select-none" style={sectionHeading}>{num}</span>
                    <div className="pt-1">
                      <h4 className="font-semibold text-cream-900 text-xs uppercase tracking-[0.2em] mb-2.5">{title}</h4>
                      <p className="text-sm text-cream-600 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── BEFORE YOUR APPOINTMENT — full-bleed espresso ── */}
        <section className="bg-cream-900 py-16 sm:py-20 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #B08D57, #F0E6CF, #B08D57, transparent)" }} />
          <div className="max-w-6xl mx-auto px-6 grid sm:grid-cols-[1fr_1.6fr] gap-10 sm:gap-16 items-center">
            <div data-reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-400 mb-3">Please Read</p>
              <h4 className="text-4xl sm:text-5xl leading-tight" style={{ ...sectionHeading, color: "#F0E6CF" }}>
                Before Your<br /><span className="italic">Appointment</span>
              </h4>
            </div>
            <div className="grid sm:grid-cols-2 gap-5" data-reveal style={{ transitionDelay: "120ms" }}>
              {[
                "Avoid picking or cutting cuticles",
                "Avoid removing or picking at old product",
                "Avoid lotions, oils, and hand creams",
                "Avoid soaking nails in water at least 2 hrs before",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-4 text-sm" style={{ color: "#E9E1D2" }}>
                  <span className="w-5 h-5 border border-gold-600 text-gold-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">✕</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOOKING FORM — white band ── */}
        <section id="booking" className="bg-white py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[1fr_1.6fr] gap-12 lg:gap-16 items-start">

            {/* Left rail — intro */}
            <div className="lg:sticky lg:top-28" data-reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-700 mb-3">03 — Reservations</p>
              <h3 className="text-4xl sm:text-5xl text-cream-900 mb-3" style={sectionHeading}>
                Book an
                <span className="block text-gold-700 mt-1" style={scriptHeadingGold}>Appointment</span>
              </h3>
              <p className="text-sm text-cream-600 leading-relaxed mb-8 max-w-sm">
                Choose your service, pick an open date, and secure your visit with a $20 deposit. You&apos;ll receive a confirmation by text and email.
              </p>
              <div className="space-y-4 border-t border-cream-200 pt-6 max-w-sm">
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500 uppercase tracking-[0.15em] text-[10px] font-semibold pt-0.5">Mon – Tue</span>
                  <span className="text-cream-700">10:00AM – 8:00PM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500 uppercase tracking-[0.15em] text-[10px] font-semibold pt-0.5">Fri</span>
                  <span className="text-cream-700">8:00AM – 6:00PM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500 uppercase tracking-[0.15em] text-[10px] font-semibold pt-0.5">Sat</span>
                  <span className="text-cream-700">8:00AM – 4:00PM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cream-500 uppercase tracking-[0.15em] text-[10px] font-semibold pt-0.5">Sun / Wed / Thu</span>
                  <span className="text-gold-700 font-medium">Closed</span>
                </div>
              </div>
            </div>

            {/* Right — the form */}
            <form ref={formRef} onSubmit={handleSubmit} data-reveal style={{ transitionDelay: "120ms" }}
              className="bg-cream-50 p-8 sm:p-10 space-y-8" >

              {/* Personal Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-cream-500 uppercase tracking-wider border-b border-cream-200 pb-2">Personal Information</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input type="text" name="name" placeholder="Full Name" required className={inputCls} />
                  <input type="text" name="instagram" placeholder="Instagram Handle" required className={inputCls} />
                </div>
                <input type="tel" name="phone" placeholder="Phone Number (e.g. 7021234567)" required
                  pattern="\d{10}" inputMode="numeric" title="Enter 10-digit phone number" className={inputCls} />
                <input type="email" name="email" placeholder="Email Address (for confirmation)" required className={inputCls} />
              </div>

              {/* Services */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-cream-500 uppercase tracking-wider border-b border-cream-200 pb-2">Services</h4>

                <select name="bookingNails" required value={bookingNails}
                  onChange={(e) => { const v = e.target.value; setBookingNails(v); if (v === "no") { setService(""); setSoakoff(""); } }}
                  className={selectCls}>
                  <option value="">Booking nails?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>

                {bookingNails === "yes" && (
                  <div className="space-y-4 bg-cream-50 p-5 border border-cream-200">
                    <select name="service" required value={service}
                      onChange={(e) => { const v = e.target.value; setService(v); setDuration(v ? 2 + (pedicure === "yes" ? 1 : 0) : pedicure === "yes" ? 1 : 0); }}
                      className={selectCls}>
                      <option value="">Select Service</option>
                      <option value="Gel-X">Gel-X</option>
                      <option value="Acrylic">Acrylic</option>
                      <option value="Gel Manicure">Gel Manicure</option>
                      <option value="Hard Gel">Hard Gel</option>
                      <option value="Builder Gel Manicure">Builder Gel Manicure</option>
                    </select>
                    <select name="soakoff" value={soakoff} onChange={(e) => setSoakoff(e.target.value)} required className={selectCls}>
                      <option value="">Soak-Off</option>
                      <option value="none">No Soak-Off</option>
                      <option value="soak-off">Soak-Off</option>
                      <option value="foreign">Foreign Soak-Off</option>
                    </select>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <select name="artLevel" className={selectCls}>
                        <option value="">Art Level</option>
                        <option value="N/A">N/A</option>
                        <option value="Level 1">Level 1</option>
                        <option value="Level 2">Level 2</option>
                        <option value="Level 3">Level 3</option>
                        <option value="Level 4">Level 4</option>
                        <option value="French Tips">French Tips</option>
                      </select>
                      <select name="Length" className={selectCls}>
                        <option value="">Nail Length</option>
                        <option value="N/A">N/A</option>
                        <option value="Small/Xtra Small">Short/Xtra Short</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                        <option value="XL/XXL">XL/XXL</option>
                      </select>
                    </div>
                  </div>
                )}

                <select name="pedicure" required value={pedicure} onChange={(e) => setPedicure(e.target.value)} className={selectCls}>
                  <option value="">Booking a pedicure?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>

                {pedicure === "yes" && (
                  <div className="bg-cream-50 p-5 border border-cream-200">
                    <select name="pedicureType" value={pedicureType} onChange={(e) => setPedicureType(e.target.value)} className={selectCls}>
                      <option value="">Pedicure Type</option>
                      <option value="Gel pedicure">Gel Pedicure</option>
                      <option value="Gel pedciure + Acrylic big toes">Gel Pedicure + Acrylic Big Toes</option>
                      <option value="Acrylic Pedicure">Acrylic Pedicure</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-cream-500 uppercase tracking-wider border-b border-cream-200 pb-2">Date & Time</h4>
                <div className="calendar-wrapper bg-white border border-cream-200 p-4">
                  <Calendar
                    value={selectedDate ? new Date(selectedDate + "T00:00:00") : null}
                    onChange={(date) => {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, "0");
                      const d = String(date.getDate()).padStart(2, "0");
                      setSelectedDate(`${y}-${m}-${d}`);
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
                <select name="start_time" value={time} onChange={(e) => setTime(e.target.value)} required className={selectCls}>
                  <option value="">Select Time</option>
                  {timeOptions.map((t) => (<option key={t} value={t}>{formatTo12Hour(t)}</option>))}
                </select>
              </div>

              {/* Additional Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-cream-500 uppercase tracking-wider border-b border-cream-200 pb-2">Additional Information</h4>
                <select name="returning" required onChange={(e) => setIsReturning(e.target.value === "yes")} className={selectCls}>
                  <option value="">Returning client?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {!isReturning && (
                  <input type="text" name="referral" required placeholder="Who referred you?" className={inputCls} />
                )}
                <textarea name="notes" placeholder="Design ideas or special requests" rows="4"
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Consent & Submit */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name="confirmSMS" required className="mt-1 w-4 h-4 border-cream-300 accent-gold-700 flex-shrink-0" />
                  <span className="text-sm text-cream-700 leading-relaxed">
                    I agree to receive automated appointment-related text messages from Mya's Nails Baby (confirmations, reminders, updates) at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. I agree to the{" "}
                    <Link href="/terms" className="text-gold-700 underline hover:text-gold-800">Terms of Service</Link> and{" "}
                    <Link href="/privacy" className="text-gold-700 underline hover:text-gold-800">Privacy Policy</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name="confirmPolicy" required className="mt-1 w-4 h-4 border-cream-300 accent-gold-700 flex-shrink-0" />
                  <span className="text-sm text-cream-700">I understand a <strong>$20 deposit</strong> is required to confirm my booking, and I authorize Mya&apos;s Nails Baby to save my card on file and charge a <strong>$25 no-show fee</strong> if I miss my appointment without notice.</span>
                </label>
                <button type="submit" disabled={isSubmitting}
                  className={`w-full py-4 font-medium text-sm tracking-wide transition active:scale-95 ${isSubmitting ? "bg-cream-300 text-cream-500 cursor-not-allowed" : "bg-gold-700 hover:bg-gold-800 text-white btn-shimmer"}`}>
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      Processing...
                    </span>
                  ) : "CONFIRM BOOKING"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── VISIT — contact + location merged ── */}
        <section id="contact" className="bg-cream-50 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left: details */}
            <div data-reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-700 mb-3">04 — Visit the Studio</p>
              <h3 className="text-5xl sm:text-6xl text-cream-900 mb-8 leading-tight" style={sectionHeading}>Contact &<br /><span className="italic text-gold-700">Location</span></h3>

              <p className="text-lg text-cream-700 mb-10 leading-relaxed" style={sectionHeading}>
                2080 E. Flamingo Rd. Suite #106 Room 4<br />Las Vegas, Nevada
              </p>

              <div className="space-y-5 mb-10">
                <a href="tel:7029818428" className="flex items-center gap-3 text-cream-700 hover:text-gold-700 transition group">
                  <svg className="w-4 h-4 text-gold-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.338c0 10.43 8.476 18.9 18.9 18.9.945 0 1.85-.693 1.85-1.64V16.81a1.5 1.5 0 0 0-1.195-1.47l-4.434-.883a1.5 1.5 0 0 0-1.537.677l-.93 1.544a.375.375 0 0 1-.437.163 13.526 13.526 0 0 1-7.516-7.516.375.375 0 0 1 .164-.437l1.544-.93a1.5 1.5 0 0 0 .678-1.537l-.883-4.434A1.5 1.5 0 0 0 7.63 2.25H3.977c-.946 0-1.728.846-1.728 1.838v2.25z"/>
                  </svg>
                  <span className="text-sm tracking-wide">(702) 981-8428</span>
                </a>
                <a href="mailto:myasnailsbaby@gmail.com" className="flex items-center gap-3 text-cream-700 hover:text-gold-700 transition group">
                  <svg className="w-4 h-4 text-gold-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
                  </svg>
                  <span className="text-sm tracking-wide">myasnailsbaby@gmail.com</span>
                </a>
                <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-cream-700 hover:text-gold-700 transition group">
                  <svg className="w-4 h-4 text-gold-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z"/>
                  </svg>
                  <span className="text-sm tracking-wide">@myasnailsbaby</span>
                </a>
              </div>

              <div className="border-t border-cream-200 pt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-500 mb-4">Studio Hours</p>
                <div className="space-y-3 text-sm text-cream-700 max-w-sm">
                  <p className="flex items-baseline gap-2"><span className="font-semibold text-cream-900 whitespace-nowrap">Mon – Tue</span><span className="flex-1 border-b border-dotted border-cream-300" /><span>10:00AM – 8:00PM</span></p>
                  <p className="flex items-baseline gap-2"><span className="font-semibold text-cream-900 whitespace-nowrap">Fri</span><span className="flex-1 border-b border-dotted border-cream-300" /><span>8:00AM – 6:00PM</span></p>
                  <p className="flex items-baseline gap-2"><span className="font-semibold text-cream-900 whitespace-nowrap">Sat</span><span className="flex-1 border-b border-dotted border-cream-300" /><span>8:00AM – 4:00PM</span></p>
                  <p className="flex items-baseline gap-2 text-gold-700 font-medium"><span className="whitespace-nowrap">Sun / Wed / Thu</span><span className="flex-1 border-b border-dotted border-cream-300" /><span>Closed</span></p>
                </div>
              </div>
            </div>

            {/* Right: tinted map */}
            <div className="overflow-hidden h-full min-h-[420px] relative" data-reveal style={{ transitionDelay: "120ms" }}>
              <div className="absolute top-0 inset-x-0 h-1 z-10" style={{ background: "linear-gradient(90deg, #8F7440, #D4BC8B, #F0E6CF, #D4BC8B, #8F7440)" }} />
              <iframe
                title="Location"
                className="map-tinted w-full h-full min-h-[360px]"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3226.887402048895!2d-115.1218948!3d36.1136458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c8c6d4c4b0e1f5%3A0x1c9624dbd4a87b5b!2s2080%20E%20Flamingo%20Rd%2C%20Las%20Vegas%2C%20NV%2089119!5e0!3m2!1sen!2sus!4v1689200000000!5m2!1sen!2sus"
                style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>

        {/* ── TAG ME ── */}
        <section className="bg-white py-20 sm:py-24 text-center">
          <div className="max-w-6xl mx-auto px-6" data-reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cream-500 mb-4">Thank you for booking with me</p>
            <h3 className="text-6xl sm:text-7xl text-cream-900 mb-8" style={scriptHeading}>Tag me in your nailfies!</h3>
            <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer"
              className="btn-lift inline-block border border-cream-300 text-cream-700 hover:border-gold-600 hover:text-gold-700 px-10 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] transition">
              @myasnailsbaby
            </a>
          </div>
        </section>

      </div>

      {/* ── FOOTER — espresso ── */}
      <footer className="bg-cream-900 relative">
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #B08D57, #F0E6CF, #B08D57, transparent)" }} />
        <div className="max-w-6xl mx-auto px-6 py-16">
          {/* Script CTA */}
          <div className="text-center mb-16" data-reveal>
            <a href="#booking" className="group inline-block">
              <p className="text-5xl sm:text-6xl transition-colors" style={{ fontFamily: "'Great Vibes', cursive", color: "#F0E6CF" }}>
                Book your appointment
              </p>
              <span className="block mx-auto mt-4 h-px w-24 group-hover:w-48 transition-all duration-500" style={{ background: "linear-gradient(90deg, transparent, #D4BC8B, transparent)" }} />
            </a>
          </div>
          <div className="grid sm:grid-cols-[1.5fr_1fr_1fr] gap-10 mb-12">
            <div>
              <p className="text-4xl mb-3" style={{ fontFamily: "'Great Vibes', cursive", color: "#F0E6CF" }}>Mya&apos;s Nails Baby</p>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: "#B3A48E" }}>
                Custom nail artistry in Las Vegas, Nevada. By appointment only.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-400 mb-4">Client Care</p>
              <div className="space-y-2.5 text-sm">
                <Link href="/reschedule" className="block transition hover:text-white" style={{ color: "#B3A48E" }}>Reschedule Appointment</Link>
                <Link href="/cancel-appointment" className="block transition hover:text-white" style={{ color: "#B3A48E" }}>Cancel Appointment</Link>
                <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="block transition hover:text-white" style={{ color: "#B3A48E" }}>Instagram</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-400 mb-4">Legal</p>
              <div className="space-y-2.5 text-sm">
                <Link href="/terms" className="block transition hover:text-white" style={{ color: "#B3A48E" }}>Terms of Service</Link>
                <Link href="/privacy" className="block transition hover:text-white" style={{ color: "#B3A48E" }}>Privacy Policy</Link>
                <Link href="/login" className="block transition hover:text-white" style={{ color: "#B3A48E" }}>Dashboard Login</Link>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: "rgba(179,164,142,0.2)" }}>
            <p className="text-xs" style={{ color: "#8C7D68" }}>© {new Date().getFullYear()} Mya&apos;s Nails Baby · Las Vegas, NV</p>
            <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "#8C7D68" }}>By Appointment Only</p>
          </div>
        </div>
      </footer>

      {/* Calendar Styles */}
      <style jsx global>{`
        /* Arch portrait frame */
        .arch-frame {
          border-radius: 999px 999px 0 0;
        }

        /* ── Motion system ── */
        [data-reveal] {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-reveal].in-view {
          opacity: 1;
          transform: translateY(0);
        }

        /* Hero load cascade */
        .hero-rise {
          opacity: 0;
          animation: heroRise 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .hero-d1 { animation-delay: 0.05s; }
        .hero-d2 { animation-delay: 0.15s; }
        .hero-d3 { animation-delay: 0.3s; }
        .hero-d4 { animation-delay: 0.45s; }
        .hero-d5 { animation-delay: 0.6s; }
        @keyframes heroRise {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Ghost script word behind hero */
        .hero-ghost {
          position: absolute;
          top: 50%;
          left: -2%;
          transform: translateY(-58%);
          font-family: 'Great Vibes', cursive;
          font-size: clamp(280px, 34vw, 560px);
          line-height: 1;
          color: #8F7440;
          opacity: 0.055;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
        }

        /* Rotating stamp */
        .stamp-spin svg { animation: stampSpin 22s linear infinite; }
        @keyframes stampSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Scroll cue */
        .scroll-cue-line {
          display: block;
          width: 1px;
          height: 44px;
          background: linear-gradient(180deg, #B08D57, transparent);
          animation: cuePulse 2.2s ease-in-out infinite;
        }
        @keyframes cuePulse {
          0%, 100% { opacity: 0.35; transform: scaleY(0.7); transform-origin: top; }
          50% { opacity: 1; transform: scaleY(1); transform-origin: top; }
        }

        /* Marquee */
        .marquee-track {
          display: inline-block;
          animation: marqueeScroll 32s linear infinite;
        }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes marqueeScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        /* Button lift */
        .btn-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .btn-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(143, 116, 64, 0.25);
        }
        .btn-lift:active { transform: translateY(0) scale(0.98); }

        /* Hide scrollbar on snap strips */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          [data-reveal], .hero-rise { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
          .stamp-spin svg, .marquee-track, .scroll-cue-line { animation: none !important; }
        }

        /* Sepia-toned map to match palette */
        .map-tinted {
          filter: sepia(0.25) saturate(0.75) contrast(0.95);
        }

        /* Champagne accent line under section headings */
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
          width: 88px;
          height: 1.5px;
          background: linear-gradient(90deg, transparent, #8F7440, #B08D57, #F0E6CF, #B08D57, #8F7440, transparent);
        }

        /* Standalone rose-gold divider line */
        .rg-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #B08D57 30%, #F0E6CF 50%, #B08D57 70%, transparent 100%);
          margin: 0;
          opacity: 0.6;
        }

        /* Card hover lift */
        .card-lift {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .card-lift:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(212,188,139,0.08);
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
          background: linear-gradient(90deg, transparent, #8F7440, #B08D57, #F0E6CF, #B08D57, #8F7440, transparent);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .policy-card:hover::before {
          opacity: 1;
        }
        .policy-card:hover {
          border-color: #B08D57;
          box-shadow: 0 10px 32px rgba(212,188,139,0.22), 0 2px 8px rgba(143,116,64,0.10);
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
          background: linear-gradient(90deg, transparent, rgba(240,230,207,0.4), transparent);
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
          background: #B08D57;
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
          color: #8F7440 !important;
        }
        .calendar-wrapper .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
        }
        .calendar-wrapper .react-calendar__tile {
          border: 1px solid #E9E1D2 !important;
          background: white !important;
          padding: 12px !important;
          transition: all 0.15s !important;
          font-size: 13px;
          color: #4E453B;
        }
        .calendar-wrapper .react-calendar__tile:hover:enabled {
          background: #FAF7F1 !important;
          border-color: #8C7D68 !important;
        }
        .calendar-wrapper .react-calendar__tile--now {
          background: #FAF7F1 !important;
          font-weight: 600 !important;
        }
        .calendar-wrapper .available-date-clean {
          background: white !important;
          color: #231D18 !important;
          font-weight: 700 !important;
          border-color: #8C7D68 !important;
        }
        .calendar-wrapper .selected-date-clean {
          background: #8F7440 !important;
          color: white !important;
          font-weight: 700 !important;
          border-color: #8F7440 !important;
        }
        .calendar-wrapper .react-calendar__tile:disabled {
          background: #FAF7F1 !important;
          color: #D9CDB8 !important;
          border-color: #F4EEE3 !important;
          cursor: default !important;
        }
        .calendar-wrapper .react-calendar__navigation {
          background: transparent !important;
          margin-bottom: 10px !important;
        }
        .calendar-wrapper .react-calendar__navigation button {
          color: #231D18 !important;
          font-weight: 600 !important;
          font-size: 14px;
        }
        .calendar-wrapper .react-calendar__navigation button:hover {
          background: #FAF7F1 !important;
        }
        .calendar-wrapper .react-calendar__month-view__weekdays {
          font-weight: 600 !important;
          color: #8C7D68 !important;
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
