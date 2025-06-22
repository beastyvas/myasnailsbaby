"use client";

import confetti from "canvas-confetti";
import toast, { Toaster } from "react-hot-toast";
import { useRef, useEffect, useState } from "react";
import NailGallery from "@/components/NailGallery";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { loadStripe } from "@stripe/stripe-js";
import { v4 as uuidv4 } from "uuid"; // Only once at the top if not already there



const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function Home() {
  const formRef = useRef();
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isReturning, setIsReturning] = useState(false);

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

const availableDates = [...new Set(availability.map((slot) => slot.date))];

const timeOptions = availability
  .filter((slot) => slot.date === selectedDate)
  .map((slot) => slot.time);


 const handleSubmit = async (e) => {
  e.preventDefault();
  const form = formRef.current;
  const data = new FormData(form);

  const name = data.get("name");
  const instagram = data.get("instagram");
  const phone = data.get("phone");
  const service = data.get("service");
  const artLevel = data.get("artLevel");
  const date = data.get("date");
  const time = data.get("time");
  const notes = data.get("notes");
  const returning = data.get("returning");
  const referral = data.get("referral");

  const bookingId = uuidv4(); // ✅ Generate unique booking ID

  const payload = {
    id: bookingId, // send this to /api/book
    name,
    instagram,
    phone,
    service,
    artLevel,
    date,
    time,
    notes,
    returning,
    referral,
  };

  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) throw new Error("Booking failed");

    toast.success("Booking request submitted!", {
      duration: 2000,
      position: "bottom-center",
    });

    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

    const bookingMetadata = {
      name,
      instagram,
      phone,
      service,
      artLevel,
      date,
      time,
      notes,
      returning,
      referral,
    };

    const stripe = await getStripe();
    const checkoutRes = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        bookingMetadata,
      }),
    });

    const checkoutData = await checkoutRes.json();
    window.location.href = checkoutData.url;

  } catch (err) {
    console.error(err);
    toast.error("Something went wrong during checkout.");
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
          <p className="text-sm sm:text-base mt-2 px-2">
            I'm Mya — a Las Vegas nail tech serving up cute sets from Gel-X to acrylic.
            Press-ons, structured manicures, & full glam designs available. DM or book below 💅✨
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
              Follow on Instagram
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
            <option value="Press-ons">Press-ons</option>
            <option value="Manicure">Structured Manicure</option>
          </select>

          <select name="artLevel" className="w-full border p-2 rounded">
            <option value="">Nail Art Level (Optional)</option>
            <option value="Level 1">Level 1</option>
            <option value="Level 2">Level 2</option>
            <option value="Level 3">Level 3</option>
            <option value="French Tips">French Tips</option>
          </select>

          <select
            name="date"
            required
            className="w-full border p-2 rounded"
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="">Select a Date</option>
            {availableDates.map((date) => {
              const [year, month, day] = date.split("-");
              const localDate = new Date(+year, +month - 1, +day);
              return (
                <option key={date} value={date}>
                  {localDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </option>
              );
            })}
          </select>

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
            placeholder="Phone Number"
            required
            className="w-full border p-2 rounded"
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

          <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 rounded-xl shadow-sm">
            Submit Booking Request
          </button>
          <Link href="/dashboard" className="text-sm text-myaAccent hover:underline mt-4 block text-center">
            Go to Dashboard
          </Link>
        </form>
      </div>
    </main>
  );
}
