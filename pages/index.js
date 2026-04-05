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

  return (
    <main className="min-h-screen bg-stone-50">
      <Toaster position="bottom-center" />

      {/* Promo Banner */}
      {promoEnabled && promoText && (
        <div className="bg-rose-800 text-white py-3 px-4 text-center text-sm font-medium">
          {promoText}
        </div>
      )}

      {/* Sticky Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-stone-900" style={sectionHeading}>
            MyasNailsBaby
          </h1>
          <nav className="hidden sm:flex items-center space-x-6 text-sm">
            <a href="#contact" className="text-stone-600 hover:text-stone-900 transition">Contact</a>
            <a href="#policies" className="text-stone-600 hover:text-stone-900 transition">Policies</a>
            <a href="#booking" className="text-stone-600 hover:text-stone-900 transition">Book</a>
          </nav>
          <a href="#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-5 py-2 text-sm font-medium transition">
            BOOK NOW
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6">

        {/* ── HERO ── */}
        <section className="py-16 text-center border-b border-stone-200">
          <div className="max-w-2xl mx-auto">
            {profilePicUrl ? (
              <img
                src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicUrl}`}
                alt="Mya - Las Vegas Nail Artist"
                className="w-40 h-40 object-cover rounded-full mx-auto mb-8 border-4 border-white shadow-xl"
              />
            ) : (
              <img
                src="/images/mya.png"
                alt="Mya - Las Vegas Nail Artist"
                className="w-40 h-40 object-cover rounded-full mx-auto mb-8 border-4 border-white shadow-xl"
              />
            )}
            <h2 className="text-6xl sm:text-7xl text-stone-900 mb-4" style={scriptHeading}>
              Your Nail Artist
            </h2>
            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
              {bioText || "Las Vegas based nail artist specializing in custom designs"}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#booking" className="bg-rose-800 hover:bg-rose-900 text-white px-10 py-3 font-medium transition text-sm tracking-wide">
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
          </div>
        </section>

        {/* ── CONTACT DETAILS ── */}
        <section id="contact" className="py-14 border-b border-stone-200">
          <h3 className="text-5xl text-stone-900 text-center mb-12 section-title-accent" style={scriptHeading}>Contact Details</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white border border-stone-200 p-6 card-lift">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Hours</p>
              <div className="space-y-1 text-sm text-stone-900">
                <p><span className="font-medium">Mon:</span> 2:00PM – 8:00PM</p>
                <p><span className="font-medium">Tue:</span> 8:00AM – 4:00PM</p>
                <p><span className="font-medium">Thu – Sat:</span> 8:00AM – 4:00PM</p>
                <p className="text-rose-700 font-medium mt-2">Wed / Sun: Closed</p>
              </div>
            </div>
            <div className="bg-white border border-stone-200 p-6">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Contact</p>
              <div className="space-y-2 text-sm text-stone-900">
                <p>(702) 981-8428</p>
                <p>myasnailsbaby@gmail.com</p>
                <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="block hover:text-rose-800 transition">@myasnailsbaby</a>
              </div>
            </div>
            <div className="bg-white border border-stone-200 p-6">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Location</p>
              <p className="text-sm text-stone-900 leading-relaxed">
                2080 E. Flamingo Rd.<br />
                Suite #106 Room 4<br />
                Las Vegas, NV
              </p>
            </div>
          </div>
        </section>

        {/* ── BOOKING POLICIES ── */}
        <section id="policies" className="py-14 border-b border-stone-200">
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
                body: "Cancellations must be made at least 48 hours in advance to avoid a cancellation fee.",
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
        <section id="booking" className="py-14 border-b border-stone-200">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-5xl text-stone-900 text-center mb-12 section-title-accent" style={scriptHeading}>Book an Appointment</h3>

            <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-stone-200 p-8 space-y-8">

              {/* Personal Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Personal Information</h4>
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
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Services</h4>

                <select name="bookingNails" required value={bookingNails}
                  onChange={(e) => { const v = e.target.value; setBookingNails(v); if (v === "no") { setService(""); setSoakoff(""); } }}
                  className={selectCls}>
                  <option value="">Booking nails?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>

                {bookingNails === "yes" && (
                  <div className="space-y-4 bg-stone-50 p-5 border border-stone-200">
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
                  <div className="bg-stone-50 p-5 border border-stone-200">
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
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Date & Time</h4>
                <div className="calendar-wrapper bg-white border border-stone-200 p-4">
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
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">Additional Information</h4>
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
                  <input type="checkbox" name="confirmSMS" required className="mt-1 w-4 h-4 border-stone-300 accent-rose-800 flex-shrink-0" />
                  <span className="text-sm text-stone-700 leading-relaxed">
                    I agree to receive automated appointment-related text messages from Mya's Nails Baby (confirmations, reminders, updates) at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. I agree to the{" "}
                    <Link href="/terms" className="text-rose-800 underline hover:text-rose-900">Terms of Service</Link> and{" "}
                    <Link href="/privacy" className="text-rose-800 underline hover:text-rose-900">Privacy Policy</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name="confirmPolicy" required className="mt-1 w-4 h-4 border-stone-300 accent-rose-800 flex-shrink-0" />
                  <span className="text-sm text-stone-700">I understand a <strong>$20 non-refundable deposit</strong> is required to confirm my booking.</span>
                </label>
                <button type="submit" disabled={isSubmitting}
                  className={`w-full py-4 font-medium text-sm tracking-wide transition ${isSubmitting ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-rose-800 hover:bg-rose-900 text-white"}`}>
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

        {/* ── LOCATION ── */}
        <section className="py-14 border-b border-stone-200">
          <h3 className="text-5xl text-stone-900 text-center mb-6 section-title-accent" style={scriptHeading}>Location</h3>
          <p className="text-center text-stone-600 text-sm mb-8">2080 E. Flamingo Rd. Suite #106 Room 4 · Las Vegas, Nevada</p>
          <div className="border border-stone-200 overflow-hidden">
            <iframe
              title="Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3226.887402048895!2d-115.1218948!3d36.1136458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c8c6d4c4b0e1f5%3A0x1c9624dbd4a87b5b!2s2080%20E%20Flamingo%20Rd%2C%20Las%20Vegas%2C%20NV%2089119!5e0!3m2!1sen!2sus!4v1689200000000!5m2!1sen!2sus"
              width="100%" height="360" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        {/* ── TAG ME ── */}
        <section className="py-14 text-center border-b border-stone-200">
          <p className="text-stone-500 text-sm uppercase tracking-widest mb-2">Thank you for booking with me</p>
          <h3 className="text-5xl text-stone-900 mb-3" style={scriptHeading}>Tag me in your nailfies</h3>
          <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer"
            className="inline-block border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-6 py-2 text-sm font-medium transition mt-2">
            @myasnailsbaby
          </a>
        </section>

        {/* ── FOOTER ── */}
        <footer className="py-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-400">
            <Link href="/terms" className="hover:text-stone-700 transition">Terms of Service</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-stone-700 transition">Privacy Policy</Link>
            <span>·</span>
            <Link href="/reschedule" className="hover:text-stone-700 transition">Reschedule Appointment</Link>
            <span>·</span>
            <Link href="/login" className="hover:text-stone-700 transition">Dashboard Login</Link>
          </div>
        </footer>

      </div>

      {/* Calendar Styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');

        /* Section heading accent underline */
        .section-title-accent {
          position: relative;
          display: inline-block;
        }
        .section-title-accent::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 48px;
          height: 2px;
          background: #9f1239;
        }

        /* Card hover lift */
        .card-lift {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .card-lift:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.09);
          transform: translateY(-2px);
        }

        /* Policy card accent on hover */
        .policy-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .policy-card:hover {
          border-color: #9f1239;
          box-shadow: 0 4px 16px rgba(159,18,57,0.08);
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
