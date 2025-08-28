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
  const [timeOptions, setTimeOptions] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [time, setTime] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [bookingNails, setBookingNails] = useState("")
  const [pedicureType, setPedicureType] = useState("");

  useEffect(() => {
    let d = 0;
    if (bookingNails === "yes") d += 2;
    if (pedicure === "yes") d += 1;
    setDuration(d);
  }, [bookingNails, pedicure]);

  useEffect(() => {
    const fetchBio = async () => {
      const { data, error } = await supabase.from("settings").select("bio").single();
      if (!error && data) setBioText(data.bio || "");
    };
    fetchBio();
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

   // fetch booked ranges via RPC (works for anon because SECURITY DEFINER)
const { data: booked, error: bookedErr } = await supabase
  .rpc('get_booked_slots', { p_date: selectedDate }); // 'YYYY-MM-DD'

if (bookedErr) {
  console.error('Booking RPC error:', bookedErr);
  return;
}

/*
  booked = [{ start_time: '14:00:00', end_time: '16:00:00' }, ...]
  Convert to hours and subtract from availability.
*/
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

      toast.success("Booking request submitted!", {
        duration: 2000,
        position: "bottom-center",
      });

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      window.location.href = stripeJson.url;
    } catch (err) {
      console.error("Error during booking:", err.message);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 p-4 sm:p-6 md:p-10 text-gray-800">
      <Toaster />
      <div className="max-w-2xl mx-auto">
        {/* Header Section */}
        <section className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <img
              src="/images/mya.png"
              alt="Mya - Las Vegas Nail Tech"
              className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-full mx-auto shadow-2xl border-4 border-white"
            />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-lg">💅</span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-4">
            Hey babes 💋
          </h2>
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
              {bioText || "Loading bio..."}
            </p>
          </div>
        </section>

        <NailGallery />

        {/* Social Links */}
        <section className="text-center mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-4">
            Book Now ✨
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <a
              href="https://instagram.com/myasnailsbaby"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-full font-semibold hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z" />
              </svg>
              Follow on Instagram
            </a>
            <a 
              href="tel:7029818428" 
              className="inline-flex items-center bg-white/70 backdrop-blur-sm text-gray-800 px-6 py-3 rounded-full font-semibold hover:bg-white/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 border border-white/20"
            >
              <span className="text-lg mr-2">📞</span> 
              (702) 981-8428
            </a>
          </div>
        </section>

        {/* Booking Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6"
        >
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Personal Info</h3>
            
            <input 
              type="text" 
              name="name" 
              placeholder="Full Name" 
              required 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200" 
            />
            
            <input 
              type="text" 
              name="instagram" 
              placeholder="Instagram Handle" 
              required 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200" 
            />
            
            <input
              type="tel"
              name="phone"
              placeholder="Phone Number (e.g. 7021234567)"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
              pattern="\d{10}"
              inputMode="numeric"
              title="Enter a 10-digit phone number (no dashes or spaces)"
            />
          </div>

          {/* Service Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Services</h3>
            
            {/* Nail Service */}
            <select
              name="bookingNails"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
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
              <option value="">💅 Are you booking nails?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>

            {bookingNails === "yes" && (
              <div className="space-y-4 bg-pink-50 rounded-xl p-4 border border-pink-200">
                <select
                  name="service"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                  value={service}
                  onChange={(e) => {
                    const val = e.target.value;
                    setService(val);
                    setDuration(
                      val ? 2 + (pedicure === "yes" ? 1 : 0) : pedicure === "yes" ? 1 : 0
                    );
                  }}
                >
                  <option value="">Select Nail Service</option>
                  <option value="Gel-X">Gel-X</option>
                  <option value="Acrylic">Acrylic</option>
                  <option value="Gel Manicure">Gel Manicure</option>
                  <option value="Hard Gel">Hard Gel</option>
                  <option value="Builder Gel Manicure">Builder Gel Manicure</option>
                </select>

                <select
                  name="soakoff"
                  value={soakoff}
                  onChange={(e) => setSoakoff(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Soak-Off Option</option>
                  <option value="none">No Soak-Off</option>
                  <option value="soak-off">Soak-Off</option>
                  <option value="foreign">Foreign Soak-Off</option>
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select 
                    name="artLevel" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Nail Art Level</option>
                    <option value="N/A">N/A</option>
                    <option value="Level 1">Level 1</option>
                    <option value="Level 2">Level 2</option>
                    <option value="Level 3">Level 3</option>
                    <option value="French Tips">French Tips</option>
                  </select>

                  <select 
                    name="Length" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                  >
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

            {/* Pedicure */}
            <select
              name="pedicure"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
              value={pedicure}
              onChange={(e) => setPedicure(e.target.value)}
            >
              <option value="">🦶 Are you booking a pedicure?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>

            {pedicure === "yes" && (
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <select
                  name="pedicureType"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
                  value={pedicureType}
                  onChange={(e) => setPedicureType(e.target.value)}
                >
                  <option value="">Select Pedicure Type</option>
                  <option value="Gel pedicure">Gel Pedicure</option>
                  <option value="Gel pedciure + Acrylic big toes">Gel Pedicure + Acrylic big toes(only)</option>
                  <option value="Acrylic Pedicure">Acrylic Pedicure</option>
                </select>
              </div>
            )}
          </div>

          {/* Date & Time Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Schedule</h3>
            
            <div className="calendar-wrapper bg-white rounded-xl p-4 shadow-sm border border-gray-200">
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
                    ? "selected-date"
                    : isAvailable
                    ? "available-date"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
            >
              <option value="">🕒 Select a Time</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {formatTo12Hour(t)}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Additional Info</h3>
            
            <select
              name="returning"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
              onChange={(e) => setIsReturning(e.target.value === "yes")}
            >
              <option value="">Have you booked with Mya before?</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>

            {!isReturning && (
              <input
                type="text"
                name="referral"
                required
                placeholder="Who referred you? (Instagram handle)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200"
              />
            )}

            <textarea 
              name="notes" 
              placeholder="Nail inspo or any details" 
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 resize-none" 
            />
          </div>

          {/* Terms & Submit */}
          <div className="space-y-4">
            <label className="flex items-start space-x-3 text-sm">
              <input type="checkbox" name="confirmPolicy" required className="mt-1 w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500" />
              <span className="text-gray-700">I understand a $20 deposit is required to book</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg ${
                isSubmitting 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                "Submit Booking Request ✨"
              )}
            </button>
          </div>
        </form>

        {/* Policies Section */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/20 mt-10 rounded-2xl p-6 shadow-lg text-center text-gray-800 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-pink-700 mb-6">📌 Policies</h2>

          <div className="space-y-6 text-sm leading-relaxed">
            <div className="text-left">
              <h3 className="font-semibold text-base mb-2 text-gray-800">❌ No-Show / Cancellation Policy</h3>
              <p className="text-gray-700">
                Cancel at least 48 hours before your appointment and there's no fee – your deposit can be applied to your next visit. 
                Last-minute cancellations or no-shows will be charged 50% of your service price.
              </p>
            </div>

            <div className="text-left">
              <h3 className="font-semibold text-base mb-2 text-gray-800">⏰ Running Late?</h3>
              <p className="text-gray-700">
                You have a 5-minute grace period if you let me know your ETA. After that, there's a $10 late fee. 
                If time is tight, I might need to shorten your service (simpler design, shorter length, etc.)
              </p>
            </div>

            <div className="text-left">
              <h3 className="font-semibold text-base mb-2 text-gray-800">✨ Squeeze-In Appointments</h3>
              <p className="text-gray-700">
                Appointments before/after regular hours are squeeze-ins and cost 50% more than your base nail price.
              </p>
            </div>

            <div className="text-left">
              <h3 className="font-semibold text-base mb-2 text-gray-800">💔 Nail Fix Policy</h3>
              <p className="text-gray-700">
                If a nail chips, cracks, or breaks within 5 days, I'll fix it for free. After 5 days, it's $10 per nail to repair.
              </p>
            </div>

            <div className="text-left">
              <h3 className="font-semibold text-base mb-2 text-gray-800">🚫 No Extra Guests</h3>
              <p className="text-gray-700">
                To keep the space calm and focused on your pampering experience, no extra guests allowed — unless they're also booked for a service. 
                Thanks for understanding, queens!
              </p>
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold mb-4 text-pink-700">📍 Address</h2>
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <p className="mb-6 text-gray-700 font-medium text-lg">
              2080 E. Flamingo Rd. Suite #106 Room 4<br />
              Las Vegas, Nevada
            </p>
            <div className="rounded-xl overflow-hidden shadow-lg">
              <iframe
                title="Mya's Nail Studio Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3226.887402048895!2d-115.1218948!3d36.1136458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c8c6d4c4b0e1f5%3A0x1c9624dbd4a87b5b!2s2080%20E%20Flamingo%20Rd%2C%20Las%20Vegas%2C%20NV%2089119!5e0!3m2!1sen!2sus!4v1689200000000!5m2!1sen!2sus"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>

        {/* Dashboard Link */}
        <div className="text-center mt-8">
          <Link 
            href="/login" 
            className="inline-flex items-center text-pink-600 hover:text-pink-700 font-medium transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Go to Dashboard
          </Link>
        </div>
      </div>

      {/* Custom Calendar Styles */}
      <style jsx global>{`
        .calendar-wrapper .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
        }
        
        .calendar-wrapper .react-calendar__tile {
          border-radius: 8px !important;
          border: none !important;
          background: transparent !important;
          padding: 12px !important;
          transition: all 0.2s ease !important;
          position: relative;
        }
        
        .calendar-wrapper .react-calendar__tile:hover:enabled {
          background: rgb(249 168 212 / 0.3) !important;
          transform: scale(1.05);
        }
        
        .calendar-wrapper .react-calendar__tile--now {
          background: rgb(244 114 182 / 0.2) !important;
          font-weight: bold !important;
        }
        
        .calendar-wrapper .available-date {
          background: rgb(244 114 182 / 0.4) !important;
          color: rgb(159 18 57) !important;
          font-weight: 600 !important;
        }
        
        .calendar-wrapper .selected-date {
          background: rgb(244 114 182) !important;
          color: white !important;
          font-weight: bold !important;
          transform: scale(1.1) !important;
        }
        
        .calendar-wrapper .react-calendar__tile:disabled {
          background: rgb(243 244 246) !important;
          color: rgb(156 163 175) !important;
        }
        
        .calendar-wrapper .react-calendar__navigation {
          background: rgb(244 114 182 / 0.1) !important;
          border-radius: 12px !important;
          margin-bottom: 16px !important;
        }
        
        .calendar-wrapper .react-calendar__navigation button {
          color: rgb(159 18 57) !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
        }
        
        .calendar-wrapper .react-calendar__navigation button:hover {
          background: rgb(244 114 182 / 0.2) !important;
        }
        
        .calendar-wrapper .react-calendar__month-view__weekdays {
          font-weight: 600 !important;
          color: rgb(107 114 128) !important;
        }
      `}</style>
    </main>
  );
}