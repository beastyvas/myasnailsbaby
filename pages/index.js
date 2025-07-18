"use client";

import confetti from "canvas-confetti";
import toast, { Toaster } from "react-hot-toast";
import { useRef, useEffect, useState } from "react";
import NailGallery from "@/components/NailGallery";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { loadStripe } from "@stripe/stripe-js";
import { v4 as uuidv4 } from "uuid"; // Only once at the top if not already there
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';




const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function Home() {
  const formRef = useRef();
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soakoff, setSoakoff] = useState("");


 useEffect(() => {
  const fetchAvailability = async () => {
    // Get available time slots
    const { data: availabilityData, error: availabilityError } = await supabase
      .from("availability")
      .select("*");

    // Get booked appointments
    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select("date, time");

    if (availabilityError || bookingsError) {
      console.error("Fetch error:", availabilityError || bookingsError);
      return;
    }

    // Filter out times that are already booked
    const filtered = availabilityData.filter((slot) => {
      return !bookingsData.some(
        (b) => b.date === slot.date && b.time === slot.time
      );
    });

    setAvailability(filtered);
  };

  fetchAvailability();
}, []);

const [bioText, setBioText] = useState("");

useEffect(() => {
  const fetchBio = async () => {
    const { data, error } = await supabase.from("settings").select("bio").single();
    if (!error && data) setBioText(data.bio || "");
  };
  fetchBio();
}, []);


const availableDates = [...new Set(availability.map((slot) => slot.date))];

const timeOptions = availability
  .filter((slot) => slot.date === selectedDate)
  .map((slot) => slot.time);


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
  const time = data.get("time");
  const length = data.get("Length");
  const notes = data.get("notes");
  const returning = data.get("returning");
  const referral = data.get("referral");
  const soakoff = data.get("soakoff");


  const bookingId = uuidv4();

  const payload = {
  id: bookingId,
  name,
  instagram,
  phone,
  service,
  artLevel,
  date,
  time,
  length,
  notes,
  returning,
  referral,
  soakoff, // ✅ new field
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
      time,
      length,
      notes,
      returning,
      soakoff,
      referral,
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
    <main className="min-h-screen bg-pink-50 p-4 sm:p-6 md:p-10 text-gray-800">
      <Toaster />
      <div className="max-w-2xl mx-auto">
        {/* ... rest of your layout unchanged */}

        <section className="text-center mb-8">
          <img
            src="/images/mya.png"
            alt="Mya - Las Vegas Nail Tech"
            className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-full mx-auto shadow-md mb-4"
          />
          <h2 className="text-2xl sm:text-3xl font-bold text-myaAccent">Hey babes 💋</h2>
         <p className="text-sm sm:text-base mt-2 px-2 whitespace-pre-wrap">
  {bioText || "Loading bio..."}
</p>

        </section>

        <NailGallery />

        <section className="text-center mb-4 animate-fade-in">
          <h2 className="text-heading font-semibold text-center mt-2 mb-2">Book Now ✨</h2>
          <div className="flex flex-col items-center gap-2">
            <a
              href="https://instagram.com/myasnailsbaby"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-myaAccent hover:underline font-medium animate-pulse"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.75 2C4.574 2 2 4.574 2 7.75v8.5C2 19.426 4.574 22 7.75 22h8.5C19.426 22 22 19.426 22 16.25v-8.5C22 4.574 19.426 2 16.25 2h-8.5zm0 1.5h8.5A5.25 5.25 0 0 1 21.5 8.75v6.5A5.25 5.25 0 0 1 16.25 20.5h-8.5A5.25 5.25 0 0 1 2.5 15.25v-6.5A5.25 5.25 0 0 1 7.75 3.5zM12 7.25A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 8.75a3.25 3.25 0 1 1-3.25 3.25A3.25 3.25 0 0 1 12 8.75zm5.75-.5a1.25 1.25 0 1 1-1.25-1.25 1.25 1.25 0 0 1 1.25 1.25z" />
              </svg>
              Follow me on Instagram!
            </a>
            <a href="tel:7029818428" className="inline-flex items-center text-myaAccent hover:underline font-medium animate-pulse">
              <span className="text-lg mr-1">📞</span> (702) 981-8428
            </a>
          </div>
        </section>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-white p-4 sm:p-6 rounded-xl shadow-md mt-4 w-full flex flex-col gap-4"
        >
          <input type="text" name="name" placeholder="Full Name" required className="w-full border p-2 rounded" />
          <input type="text" name="instagram" placeholder="Instagram Handle" required className="w-full border p-2 rounded" />

          <select name="service" required className="w-full border p-2 rounded">
            <option value="">Select a Service</option>
            <option value="Gel-X">Gel-X</option>
            <option value="Acrylic">Acrylic</option>
            <option value="Manicure">Gel Manicure</option>
            <option value="Manicure">Hard gel</option>
            <option value="Manicure">Builder Gel Manicure</option>
          </select>

<select
  name="soakoff"
  value={soakoff}
  onChange={(e) => setSoakoff(e.target.value)}
  required
  className="w-full border p-2 rounded"
>
  <option value="">Select a Soak-Off option</option>
  <option value="none">No Soak-Off</option>
  <option value="soak-off">Soak-Off</option>
  <option value="foreign">Foreign Soak-Off</option>
</select>


          <select name="artLevel" className="w-full border p-2 rounded">
            <option value="">Nail Art Level </option>
            <option value="N/A">N/A</option>
            <option value="Level 1">Level 1</option>
            <option value="Level 2">Level 2</option>
            <option value="Level 3">Level 3</option>
            <option value="French Tips">French Tips</option>
          </select>

<select name="Length" className="w-full border p-2 rounded">
            <option value="">Nail Length </option>
            <option value="N/A">N/A</option>
            <option value="Small/Xtra Small">Small/Xtra Small</option>
            <option value="Medium">Medium</option>
            <option value="Large">Large</option>
            <option value="XL/XXL">XL/XXL</option>
          </select>

        
{/* 📅 Date Picker Calendar */}
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
    ? "bg-pink-600 text-white font-semibold rounded-full"
    : isAvailable
    ? "bg-pink-100 font-semibold rounded-full"
    : null;
}}

  className="w-full border rounded p-2 mb-4"
/>
<input type="hidden" name="date" value={selectedDate} />


{/* ⏰ Time Slot Dropdown */}
<select
  name="time"
  required
  className="w-full border p-2 rounded"
  disabled={!selectedDate}
>
  <option value="">Select a Time</option>
  {timeOptions.map((time, idx) => (
    <option key={idx} value={time}>
      {time}
    </option>
  ))}
</select>
          <input
  type="tel"
  name="phone"
  placeholder="Phone Number (e.g. 7021234567)"
  required
  className="w-full border p-2 rounded"
  pattern="\d{10}"
  inputMode="numeric"
  title="Enter a 10-digit phone number (no dashes or spaces)"
/>

          <label className="block text-sm font-medium text-gray-700">Have you booked with Mya before?</label>
          <select
            name="returning"
            required
            className="w-full border p-2 rounded"
            onChange={(e) => setIsReturning(e.target.value === "yes")}
          >
            <option value="">-- Select an Option --</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          {!isReturning && (
            <input
              type="text"
              name="referral"
              required
              placeholder="Who referred you? (Instagram handle)"
              className="w-full border p-2 rounded"
            />
          )}

          <textarea name="notes" placeholder="Nail inspo or any details" className="w-full border p-2 rounded" />

          <label className="flex items-center space-x-2 text-sm">
            <input type="checkbox" name="confirmPolicy" required />
            <span>I understand a $20 deposit is required to book</span>
          </label>

         <button
  type="submit"
  disabled={isSubmitting}
  className={`w-full text-white font-semibold py-2 rounded-xl shadow-sm ${
    isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-600"
  }`}
>
  {isSubmitting ? "Submitting..." : "Submit Booking Request"}
</button>
<div className="bg-white border mt-10 rounded-lg p-6 shadow text-center text-gray-800 max-w-2xl mx-auto">
  <h2 className="text-2xl font-semibold text-pink-700 mb-6">📌 Policies</h2>

  <div className="space-y-6 text-sm leading-relaxed">
  
    <div>
      <h3 className="font-semibold text-base mb-1">❌ No-Show / Cancellation Policy</h3>
      <p>
        Cancel at least 48 hours before your appointment and there’s no fee –<br />
        your deposit can be applied to your next visit.<br />
        Last-minute cancellations or no-shows will be charged 50% of your service price.
      </p>
    </div>

    <div>
      <h3 className="font-semibold text-base mb-1">⏰ Running Late?</h3>
      <p>
        You have a 5-minute grace period if you let me know your ETA.<br />
        After that, there’s a $10 late fee. If time is tight, I might need to shorten your service<br />
        (simpler design, shorter length, etc.)
      </p>
    </div>

    <div>
      <h3 className="font-semibold text-base mb-1">✨ Squeeze-In Appointments</h3>
      <p>
        Appointments before/after regular hours are squeeze-ins<br />
        and cost 50% more than your base nail price.
      </p>
    </div>

    <div>
      <h3 className="font-semibold text-base mb-1">💔 Nail Fix Policy</h3>
      <p>
        If a nail chips, cracks, or breaks within 5 days, I’ll fix it for free.<br />
        After 5 days, it’s $10 per nail to repair.
      </p>
    </div>

    <div>
      <h3 className="font-semibold text-base mb-1">🚫 No Extra Guests</h3>
      <p>
        To keep the space calm and focused on your pampering experience,<br />
        no extra guests allowed — unless they’re also booked for a service.<br />
        Thanks for understanding, queens! 
      </p>
    </div>
  </div>
</div>

<div className="mt-12 text-center">
  <h2 className="text-2xl font-semibold mb-2 text-pink-700">📍 Address</h2>
  <p className="mb-4 text-gray-700 font-medium">
    2080 E. Flamingo Rd. Suite #106 Room 4<br />
    Las Vegas, Nevada
  </p>
  <div className="w-full max-w-2xl mx-auto rounded-lg overflow-hidden shadow">
    <iframe
      title="Mya's Nail Studio Location"
      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3226.887402048895!2d-115.1218948!3d36.1136458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c8c6d4c4b0e1f5%3A0x1c9624dbd4a87b5b!2s2080%20E%20Flamingo%20Rd%2C%20Las%20Vegas%2C%20NV%2089119!5e0!3m2!1sen!2sus!4v1689200000000!5m2!1sen!2sus"
      width="100%"
      height="300"
      style={{ border: 0 }}
      allowFullScreen=""
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    ></iframe>
  </div>
</div>
          <Link href="/dashboard" className="text-sm text-myaAccent hover:underline mt-4 block text-center">
            Go to Dashboard
          </Link>
        </form>
      </div>
    </main>
  );
}