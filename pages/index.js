"use client";

import confetti from "canvas-confetti";
import toast, { Toaster } from "react-hot-toast";
import { useRef, useEffect, useState } from "react";
import NailGallery from "@/components/NailGallery";
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
        .rpc('get_booked_slots', { p_date: selectedDate });

      if (bookedErr) {
        console.error('Booking RPC error:', bookedErr);
        return;
      }

      const bookedRanges = booked.map(({ start_time, end_time }) => {
        const [sh] = String(start_time).split(':');
        const [eh] = String(end_time).split(':');
        return { start: parseInt(sh, 10), end: parseInt(eh, 10) };
      });

      const available = [];
      for (let hour = startHour; hour <= endHour - duration; hour++) {
        const overlaps = bookedRanges.some(r => hour < r.end && (hour + duration) > r.start);
        if (!overlaps) available.push(`${String(hour).padStart(2,'0')}:00`);
      }
      setTimeOptions(available);
    }

    loadAvailableTimes();
  }, [selectedDate, duration]);

  useEffect(() => {
    const fetchAvailableDates = async () => {
      const { data, error } = await supabase
        .from("availability")
        .select("date");

      if (error) {
        console.error("Failed to fetch available dates:", error.message);
        return;
      }

      const normalized = [
        ...new Set(data.map((d) => new Date(d.date).toISOString().split("T")[0])),
      ];
      setAvailableDates(normalized);
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

    const payload = {
      id: bookingId,
      name,
      instagram,
      phone,
      service,
      artLevel,
      date,
      start_time,
      length,
      notes,
      returning,
      duration: durationHours,
      soakoff,
      referral,
      pedicure,
      pedicure_type: pedicureType,
      booking_nails: bookingNails,
    };

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("Booking failed");

      const bookingMetadata = {
        booking_id: bookingId,
        name,
        instagram,
        phone,
        service,
        artLevel,
        date,
        start_time,
        length,
        notes,
        returning,
        pedicure_type: pedicureType,
        booking_nails: bookingNails,
        duration: durationHours,
        soakoff,
        referral,
        pedicure,
      };

      const stripeRes = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingMetadata }),
      });

      const stripeJson = await stripeRes.json();
      if (!stripeRes.ok) throw new Error(stripeJson.error || "Stripe checkout failed");

      toast.success("Booking confirmed! Redirecting to payment... 💅✨", {
        duration: 2000,
        position: "bottom-center",
        style: {
          borderRadius: '30px',
          background: '#fecdd3',
          color: '#881337',
          padding: '16px 24px',
          fontWeight: '600',
        },
      });

      confetti({ 
        particleCount: 150, 
        spread: 100, 
        origin: { y: 0.6 },
        colors: ['#fda4af', '#fb7185', '#f472b6', '#ec4899']
      });

      window.location.href = stripeJson.url;
    } catch (err) {
      console.error("Error during booking:", err.message);
      toast.error("Oops! Something went wrong. Please try again 💕", {
        style: {
          borderRadius: '30px',
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px 24px',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100">
      <Toaster position="bottom-center" />
      
      {/* Promo Banner */}
      {promoEnabled && promoText && (
        <div className="bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 text-white py-3 px-4 text-center text-sm font-medium shadow-lg">
          ✨ {promoText} ✨
        </div>
      )}

      {/* Header/Nav */}
      <header className="bg-white/90 backdrop-blur-md border-b border-pink-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent" style={{fontFamily: 'Georgia, serif'}}>
            MyasNailsBaby
          </h1>
          <nav className="hidden sm:flex items-center space-x-8 text-sm">
            <a href="#services" className="text-rose-700 hover:text-rose-900 transition font-medium">Services</a>
            <a href="#booking" className="text-rose-700 hover:text-rose-900 transition font-medium">Book</a>
            <a href="#policies" className="text-rose-700 hover:text-rose-900 transition font-medium">Policies</a>
            <a href="tel:7029818428" className="text-rose-700 hover:text-rose-900 transition font-medium">📞 Call</a>
          </nav>
          <a
            href="#booking"
            className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white px-6 py-2 text-sm font-medium rounded-full transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg"
          >
            BOOK NOW ✨
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6">
        {/* Hero Section */}
        <section className="py-20 text-center relative overflow-hidden">
          {/* Decorative floating elements */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-pink-200 rounded-full blur-3xl opacity-60 animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 bg-rose-200 rounded-full blur-3xl opacity-60 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-pink-300 rounded-full blur-2xl opacity-40 animate-pulse" style={{animationDelay: '2s'}}></div>
          
          <div className="max-w-3xl mx-auto relative z-10">
            <div className="relative inline-block mb-8">
              {profilePicUrl ? (
                <img
                  src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicUrl}`}
                  alt="Mya - Las Vegas Nail Artist"
                  className="w-52 h-52 object-cover mx-auto border-4 border-white shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer"
                  style={{borderRadius: '50%'}}
                />
              ) : (
                <img
                  src="/images/mya.png"
                  alt="Mya - Las Vegas Nail Artist"
                  className="w-52 h-52 object-cover mx-auto border-4 border-white shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer"
                  style={{borderRadius: '50%'}}
                />
              )}
              {/* Sparkle effects */}
              <div className="absolute -top-2 -right-2 text-4xl animate-bounce">✨</div>
              <div className="absolute -bottom-2 -left-2 text-3xl animate-bounce" style={{animationDelay: '0.5s'}}>💅</div>
            </div>
            
            <h2 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 bg-clip-text text-transparent mb-6" style={{fontFamily: 'Georgia, serif'}}>
              Luxury Nail Artistry
            </h2>
            <p className="text-xl text-rose-900 mb-8 leading-relaxed font-medium">
              {bioText || "Las Vegas based nail artist specializing in custom designs 💅"}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://instagram.com/myasnailsbaby"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-gradient-to-r from-pink-400 to-rose-400 text-white px-8 py-4 font-medium rounded-full hover:scale-105 hover:shadow-xl transition-all duration-300 shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z" />
                </svg>
                Follow on Instagram
              </a>
              <a
                href="tel:7029818428"
                className="inline-flex items-center bg-white border-2 border-pink-300 text-rose-900 px-8 py-4 font-medium rounded-full hover:bg-pink-50 hover:border-pink-400 hover:scale-105 transition-all duration-300 shadow-md"
              >
                📞 (702) 981-8428
              </a>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="services" className="py-16">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent inline-block mb-4" style={{fontFamily: 'Georgia, serif'}}>
              Portfolio
            </h3>
            <p className="text-rose-700 font-medium">✨ Our Latest Work ✨</p>
          </div>
          <NailGallery />
        </section>

        {/* Booking Form */}
        <section id="booking" className="py-16">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent inline-block mb-4" style={{fontFamily: 'Georgia, serif'}}>
                Book an Appointment
              </h3>
              <p className="text-rose-700 font-medium">💅 Let's make your nail dreams come true!</p>
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-8 sm:p-12 space-y-8 shadow-2xl hover:shadow-pink-200/50 transition-shadow duration-300"
            >
              {/* Personal Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b-2 border-pink-200">
                  <span className="text-2xl">👤</span>
                  <h4 className="text-lg font-bold text-rose-900">Personal Info</h4>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    required
                    className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 placeholder-rose-400 bg-white/50"
                  />
                  
                  <input
                    type="text"
                    name="instagram"
                    placeholder="Instagram Handle"
                    required
                    className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 placeholder-rose-400 bg-white/50"
                  />
                </div>

                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number (e.g. 7021234567)"
                  required
                  className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 placeholder-rose-400 bg-white/50"
                  pattern="\d{10}"
                  inputMode="numeric"
                />
              </div>

              {/* Services */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b-2 border-pink-200">
                  <span className="text-2xl">💅</span>
                  <h4 className="text-lg font-bold text-rose-900">Services</h4>
                </div>
                
                <select
                  name="bookingNails"
                  required
                  className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/50 font-medium cursor-pointer"
                  value={bookingNails}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBookingNails(val);
                    if (val === "no") {
                      setService("");
                      setSoakoff("");
                    }
                  }}
                >
                  <option value="">Booking nails?</option>
                  <option value="yes">Yes please! 💅</option>
                  <option value="no">Not today</option>
                </select>

                {bookingNails === "yes" && (
                  <div className="space-y-4 bg-gradient-to-br from-pink-50 to-rose-50 p-6 rounded-2xl border-2 border-pink-200 animate-slideIn">
                    <select
                      name="service"
                      required
                      className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/80 font-medium cursor-pointer"
                      value={service}
                      onChange={(e) => {
                        const val = e.target.value;
                        setService(val);
                        setDuration(
                          val ? 2 + (pedicure === "yes" ? 1 : 0) : pedicure === "yes" ? 1 : 0
                        );
                      }}
                    >
                      <option value="">Select Service</option>
                      <option value="Gel-X">✨ Gel-X</option>
                      <option value="Acrylic">💎 Acrylic</option>
                      <option value="Gel Manicure">💅 Gel Manicure</option>
                      <option value="Hard Gel">🌟 Hard Gel</option>
                      <option value="Builder Gel Manicure">✨ Builder Gel Manicure</option>
                    </select>

                    <select
                      name="soakoff"
                      value={soakoff}
                      onChange={(e) => setSoakoff(e.target.value)}
                      required
                      className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/80 font-medium cursor-pointer"
                    >
                      <option value="">Soak-Off Options</option>
                      <option value="none">No Soak-Off</option>
                      <option value="soak-off">Soak-Off</option>
                      <option value="foreign">Foreign Soak-Off</option>
                    </select>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <select
                        name="artLevel"
                        className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/80 font-medium cursor-pointer"
                      >
                        <option value="">Art Level</option>
                        <option value="N/A">N/A</option>
                        <option value="Level 1">🎨 Level 1</option>
                        <option value="Level 2">🎨 Level 2</option>
                        <option value="Level 3">🎨 Level 3</option>
                        <option value="Level 4">🎨 Level 4</option>
                        <option value="French Tips">💅 French Tips</option>
                      </select>

                      <select
                        name="Length"
                        className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/80 font-medium cursor-pointer"
                      >
                        <option value="">Length</option>
                        <option value="N/A">N/A</option>
                        <option value="Small/Xtra Small">Short/Xtra Short</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                        <option value="XL/XXL">XL/XXL</option>
                      </select>
                    </div>
                  </div>
                )}

                <select
                  name="pedicure"
                  required
                  className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/50 font-medium cursor-pointer"
                  value={pedicure}
                  onChange={(e) => setPedicure(e.target.value)}
                >
                  <option value="">Booking pedicure?</option>
                  <option value="yes">Yes please! 🦶✨</option>
                  <option value="no">Not today</option>
                </select>

                {pedicure === "yes" && (
                  <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-6 rounded-2xl border-2 border-pink-200 animate-slideIn">
                    <select
                      name="pedicureType"
                      className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/80 font-medium cursor-pointer"
                      value={pedicureType}
                      onChange={(e) => setPedicureType(e.target.value)}
                    >
                      <option value="">Pedicure Type</option>
                      <option value="Gel pedicure">💅 Gel Pedicure</option>
                      <option value="Gel pedciure + Acrylic big toes">✨ Gel Pedicure + Acrylic Big Toes</option>
                      <option value="Acrylic Pedicure">💎 Acrylic Pedicure</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b-2 border-pink-200">
                  <span className="text-2xl">📅</span>
                  <h4 className="text-lg font-bold text-rose-900">Pick Your Date & Time</h4>
                </div>
                
                <div className="calendar-wrapper bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-lg">
                  <Calendar
                    value={selectedDate ? new Date(selectedDate + "T00:00:00") : null}
                    onChange={(date) => {
                      const isoDate = date.toISOString().split("T")[0];
                      setSelectedDate(isoDate);
                    }}
                    tileDisabled={({ date }) => {
                      const iso = date.toISOString().split("T")[0];
                      return !availableDates.includes(iso);
                    }}
                    tileClassName={({ date }) => {
                      const iso = date.toISOString().split("T")[0];
                      const isSelected = selectedDate === iso;
                      const isAvailable = availableDates.includes(iso);

                      return isSelected
                        ? "selected-date-pink"
                        : isAvailable
                        ? "available-date-pink"
                        : null;
                    }}
                    calendarType="US"
                    className="w-full"
                  />
                </div>

                <input type="hidden" name="date" value={selectedDate || ""} />

                <select
                  name="start_time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/50 font-medium cursor-pointer"
                >
                  <option value="">Select Time ⏰</option>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {formatTo12Hour(t)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b-2 border-pink-200">
                  <span className="text-2xl">💬</span>
                  <h4 className="text-lg font-bold text-rose-900">Tell Us More</h4>
                </div>
                
                <select
                  name="returning"
                  required
                  className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 bg-white/50 font-medium cursor-pointer"
                  onChange={(e) => setIsReturning(e.target.value === "yes")}
                >
                  <option value="">Returning client?</option>
                  <option value="yes">Yes, I've been here before! 💕</option>
                  <option value="no">First time! ✨</option>
                </select>

                {!isReturning && (
                  <input
                    type="text"
                    name="referral"
                    required
                    placeholder="Who referred you? 💖"
                    className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition text-rose-900 placeholder-rose-400 bg-white/50 animate-slideIn"
                  />
                )}

                <textarea
                  name="notes"
                  placeholder="✨ Design ideas or special requests? Share your vision!"
                  rows="4"
                  className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:border-pink-400 focus:ring-0 transition resize-none text-rose-900 placeholder-rose-400 bg-white/50"
                />
              </div>

              {/* Submit */}
              <div className="space-y-4">
               <label className="flex items-start space-x-3 bg-pink-50 p-4 rounded-2xl border border-pink-200">
  <input
    type="checkbox"
    name="confirmPolicy"
    required
    className="mt-1 w-5 h-5 border-pink-300 text-pink-500 focus:ring-pink-400 rounded"
  />
  <span className="text-sm text-rose-900">
    I understand a <strong className="text-rose-700">$20 deposit</strong> is required to secure my spot. 
    By booking, I agree to the <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>, 
    and consent to receive appointment-related text messages. Message and data rates may apply. Reply STOP to opt out.
  </span>
</label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-5 font-bold text-lg rounded-full transition-all duration-300 ${
                    isSubmitting
                      ? "bg-pink-200 text-rose-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg hover:shadow-xl hover:scale-105"
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing your booking...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <span>CONFIRM BOOKING</span>
                      <span>✨💅</span>
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Policies */}
        <section id="policies" className="py-16">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent inline-block mb-4" style={{fontFamily: 'Georgia, serif'}}>
                Policies
              </h3>
            </div>

            <div className="space-y-6">
              <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-6 hover:shadow-lg hover:border-pink-300 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">📅</span>
                  <div>
                    <h4 className="font-bold text-rose-900 text-lg mb-2">Cancellation Policy</h4>
                    <p className="text-rose-700 leading-relaxed">
                      Cancel at least 48 hours in advance to apply your deposit to a future appointment. 
                      Cancellations within 48 hours or no-shows will be charged 50% of the service price.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-6 hover:shadow-lg hover:border-pink-300 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">⏰</span>
                  <div>
                    <h4 className="font-bold text-rose-900 text-lg mb-2">Late Arrivals</h4>
                    <p className="text-rose-700 leading-relaxed">
                      You have a 5-minute grace period. Please text your ETA! After that, a $10 late fee applies 
                      and your service may need to be adjusted to stay on schedule.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-6 hover:shadow-lg hover:border-pink-300 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">✨</span>
                  <div>
                    <h4 className="font-bold text-rose-900 text-lg mb-2">Squeeze-In Appointments</h4>
                    <p className="text-rose-700 leading-relaxed">
                      Need us outside regular hours? We got you! Appointments outside regular hours 
                      include a 50% surcharge on the base service price.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-6 hover:shadow-lg hover:border-pink-300 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🔧</span>
                  <div>
                    <h4 className="font-bold text-rose-900 text-lg mb-2">Repairs</h4>
                    <p className="text-rose-700 leading-relaxed">
                      Free repairs within 5 days - we've got you covered! After 5 days, repairs are 
                      $10 per nail.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-6 hover:shadow-lg hover:border-pink-300 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">💁‍♀️</span>
                  <div>
                    <h4 className="font-bold text-rose-900 text-lg mb-2">Guests</h4>
                    <p className="text-rose-700 leading-relaxed">
                      To maintain a professional and relaxing environment, only clients receiving 
                      services may attend appointments. Thank you for understanding! 💕
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Location */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent inline-block mb-4" style={{fontFamily: 'Georgia, serif'}}>
                Find Us
              </h3>
              <p className="text-rose-700 font-medium">📍 Come visit !</p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-8 mb-6 text-center shadow-lg">
              <p className="text-rose-900 font-bold text-lg mb-1">
                2080 E. Flamingo Rd. Suite #106 Room 4
              </p>
              <p className="text-rose-700 font-medium">Las Vegas, Nevada ✨</p>
            </div>

            <div className="border-2 border-pink-200 overflow-hidden rounded-3xl shadow-xl">
              <iframe
                title="Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3226.887402048895!2d-115.1218948!3d36.1136458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c8c6d4c4b0e1f5%3A0x1c9624dbd4a87b5b!2s2080%20E%20Flamingo%20Rd%2C%20Las%20Vegas%2C%20NV%2089119!5e0!3m2!1sen!2sus!4v1689200000000!5m2!1sen!2sus"
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>

         {/* Footer */}
        <footer className="py-12 text-center">
          <div className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/terms"
                className="text-sm text-rose-500 hover:text-rose-700 transition font-medium bg-white/50 px-6 py-2 rounded-full border border-pink-200 inline-block hover:bg-pink-50"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-rose-500 hover:text-rose-700 transition font-medium bg-white/50 px-6 py-2 rounded-full border border-pink-200 inline-block hover:bg-pink-50"
              >
                Privacy Policy
              </Link>
              <Link
                href="/login"
                className="text-sm text-rose-500 hover:text-rose-700 transition font-medium bg-white/50 px-6 py-2 rounded-full border border-pink-200 inline-block hover:bg-pink-50"
              >
                Dashboard Login 🔐
              </Link>
            </div>
          </div>
          <p className="text-rose-400 text-sm">Made with 💕 in Las Vegas</p>
        </footer>
      </div>
      {/* Custom Styles */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }

        /* Calendar Styles - Pink Theme */
        .calendar-wrapper .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
          background: transparent;
        }
        
        .calendar-wrapper .react-calendar__tile {
          border: 2px solid #fecdd3 !important;
          background: white !important;
          padding: 16px !important;
          transition: all 0.2s !important;
          font-size: 14px;
          color: #881337;
          border-radius: 12px !important;
          margin: 2px !important;
          font-weight: 600;
        }
        
        .calendar-wrapper .react-calendar__tile:hover:enabled {
          background: #fef2f2 !important;
          border-color: #fb7185 !important;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(251, 113, 133, 0.2);
        }
        
        .calendar-wrapper .react-calendar__tile--now {
          background: #fef2f2 !important;
          font-weight: 700 !important;
          border-color: #fb7185 !important;
        }
        
        .calendar-wrapper .available-date-pink {
          background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%) !important;
          color: #881337 !important;
          font-weight: 700 !important;
          border-color: #f9a8d4 !important;
          box-shadow: 0 2px 8px rgba(251, 113, 133, 0.15);
        }
        
        .calendar-wrapper .available-date-pink:hover {
          background: linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%) !important;
        }
        
        .calendar-wrapper .selected-date-pink {
          background: linear-gradient(135deg, #fb7185 0%, #f43f5e 100%) !important;
          color: white !important;
          font-weight: 700 !important;
          border-color: #f43f5e !important;
          box-shadow: 0 4px 16px rgba(244, 63, 94, 0.4) !important;
          transform: scale(1.05);
        }
        
        .calendar-wrapper .react-calendar__tile:disabled {
          background: #fafafa !important;
          color: #fecdd3 !important;
          border-color: #fef2f2 !important;
          cursor: not-allowed;
        }
        
        .calendar-wrapper .react-calendar__navigation {
          background: transparent !important;
          margin-bottom: 16px !important;
        }
        
        .calendar-wrapper .react-calendar__navigation button {
          color: #881337 !important;
          font-weight: 700 !important;
          font-size: 16px;
          background: white;
          border-radius: 12px;
          padding: 12px;
          border: 2px solid #fecdd3;
          transition: all 0.2s;
        }
        
        .calendar-wrapper .react-calendar__navigation button:hover {
          background: #fef2f2 !important;
          border-color: #fb7185;
          transform: scale(1.05);
        }
        
        .calendar-wrapper .react-calendar__month-view__weekdays {
          font-weight: 700 !important;
          color: #be123c !important;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .calendar-wrapper .react-calendar__month-view__weekdays__weekday {
          padding: 12px !important;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 10px;
        }

        ::-webkit-scrollbar-track {
          background: #fef2f2;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #fb7185 0%, #f43f5e 100%);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
        }

        /* Custom animations */
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}