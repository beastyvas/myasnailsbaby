"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import dynamic from "next/dynamic";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import "react-calendar/dist/Calendar.css";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });

export default function ReschedulePage() {
  // Step management
  const [step, setStep] = useState(1); // 1=phone, 2=show booking, 3=pick new time, 4=confirmed

  // Form data
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  // New appointment selection
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [timeOptions, setTimeOptions] = useState([]);
  const [selectedTime, setSelectedTime] = useState("");

  // Helper: Format phone for display
  const formatPhoneDisplay = (num) => {
    const cleaned = num.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return num;
  };

  // Helper: Format time to 12hr
  const to12h = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr = "00"] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr}${suffix}`;
  };

  // Helper: Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    });
  };

  // Step 1: Lookup booking by phone
  const handleLookup = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanPhone = phone.replace(/\D/g, "");
    
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/lookup-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Booking not found");
        setLoading(false);
        return;
      }

      setBooking(data.booking);
      setStep(2);
      toast.success("Booking found!");
    } catch (err) {
      console.error("Lookup error:", err);
      toast.error("Failed to lookup booking");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → 3: Start reschedule process
  const handleStartReschedule = () => {
    if (!booking.can_reschedule) {
      toast.error("Cannot reschedule within 48 hours of appointment");
      return;
    }

    if (booking.reschedule_count >= 2) {
      toast.error("Maximum reschedule limit reached (2)");
      return;
    }

    setStep(3);
    fetchAvailableDates();
  };

  // Fetch available dates
  const fetchAvailableDates = async () => {
    const { data, error } = await supabase
      .from("availability")
      .select("date");

    if (error) {
      console.error("Failed to fetch dates:", error);
      return;
    }

    // Get Vegas time + 24hr minimum
    const now = new Date();
    const vegasNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const minDate = new Date(vegasNow);
    minDate.setHours(minDate.getHours() + 24);
    const minDateStr = minDate.toISOString().split("T")[0];

    const validDates = data
      .map((d) => d.date)
      .filter((date) => date >= minDateStr);

    setAvailableDates([...new Set(validDates)]);
  };

  // Load available times when date selected
  useEffect(() => {
    if (!selectedDate || !booking) return;

    const loadTimes = async () => {
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

      const bookedRanges = booked
        .filter((b) => b.id !== booking.id) // Exclude current booking
        .map(({ start_time, end_time }) => {
          const [sh] = String(start_time).split(":");
          const [eh] = String(end_time).split(":");
          return { start: parseInt(sh, 10), end: parseInt(eh, 10) };
        });

      // 24-hour restriction
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

      const duration = booking.duration || 2;
      const available = [];
      
      for (let hour = minimumHour; hour <= endHour - duration; hour++) {
        const overlaps = bookedRanges.some(
          (r) => hour < r.end && hour + duration > r.start
        );
        if (!overlaps) {
          available.push(`${String(hour).padStart(2, "0")}:00`);
        }
      }

      setTimeOptions(available);
    };

    loadTimes();
  }, [selectedDate, booking]);

  // Step 3 → 4: Confirm reschedule
  const handleConfirmReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reschedule-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: booking.id,
          phone: phone.replace(/\D/g, ""),
          new_date: selectedDate,
          new_time: selectedTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to reschedule");
        setLoading(false);
        return;
      }

      // Update local booking state for confirmation screen
      setBooking({
        ...booking,
        old_date: booking.date,
        old_time: booking.start_time,
        date: selectedDate,
        start_time: selectedTime,
      });

      setStep(4);
      toast.success("Appointment rescheduled!");
    } catch (err) {
      console.error("Reschedule error:", err);
      toast.error("Failed to reschedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 py-12 px-4">
      <Toaster position="top-center" />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">
            Mya's Nails Baby 💅
          </h1>
          <p className="text-gray-600">Reschedule Your Appointment</p>
        </div>

        {/* STEP 1: Phone Lookup */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-pink-200">
            <h2 className="text-2xl font-bold text-pink-700 mb-4">
              Find Your Booking
            </h2>
            <p className="text-gray-600 mb-6">
              Enter the phone number you used when booking:
            </p>

            <form onSubmit={handleLookup}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(702) 555-1234"
                className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:border-pink-500 focus:outline-none text-lg mb-4"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold py-4 rounded-xl hover:from-pink-600 hover:to-rose-600 transition disabled:opacity-50"
              >
                {loading ? "Searching..." : "Find My Booking"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/" className="text-pink-600 hover:underline text-sm">
                ← Back to Booking Page
              </Link>
            </div>
          </div>
        )}

        {/* STEP 2: Show Current Booking */}
        {step === 2 && booking && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-pink-200">
            <h2 className="text-2xl font-bold text-pink-700 mb-6">
              📅 Current Appointment
            </h2>

            <div className="bg-pink-50 rounded-xl p-6 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Name:</span>
                  <span className="font-bold text-gray-900">{booking.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Service:</span>
                  <span className="font-bold text-gray-900">
                    {booking.service}
                    {booking.pedicure_type && booking.pedicure_type !== "N/A"
                      ? ` + ${booking.pedicure_type}`
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Date:</span>
                  <span className="font-bold text-gray-900">
                    {formatDateShort(booking.date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Time:</span>
                  <span className="font-bold text-gray-900">
                    {to12h(booking.start_time)}
                  </span>
                </div>
              </div>
            </div>

            {/* Can reschedule? */}
            {booking.can_reschedule ? (
              <>
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6">
                  <p className="text-green-800 text-sm">
                    ✅ You can reschedule this appointment
                    <br />
                    <span className="text-xs text-green-600">
                      ({booking.hours_until} hours until appointment)
                    </span>
                  </p>
                </div>

                {booking.reschedule_count > 0 && (
                  <p className="text-sm text-gray-500 mb-4">
                    You've rescheduled {booking.reschedule_count} time(s). Max 2
                    allowed.
                  </p>
                )}

                <button
                  onClick={handleStartReschedule}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold py-4 rounded-xl hover:from-pink-600 hover:to-rose-600 transition"
                >
                  Choose New Date/Time
                </button>
              </>
            ) : (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
                <h3 className="font-bold text-yellow-800 mb-2">
                  ⚠️ Too Late to Reschedule Online
                </h3>
                <p className="text-yellow-700 text-sm mb-4">
                  Your appointment is in less than 48 hours. You can no longer
                  reschedule online.
                </p>
                <p className="text-yellow-700 text-sm font-medium">
                  Please DM{" "}
                  <a
                    href="https://instagram.com/myasnailsbaby"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    @myasnailsbaby
                  </a>{" "}
                  on Instagram
                </p>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setStep(1);
                  setBooking(null);
                  setPhone("");
                }}
                className="text-pink-600 hover:underline text-sm"
              >
                ← Search Different Phone Number
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Pick New Date/Time */}
        {step === 3 && booking && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-pink-200">
            <h2 className="text-2xl font-bold text-pink-700 mb-6">
              Choose New Appointment
            </h2>

            {/* Calendar */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select New Date:
              </label>
              <Calendar
                onChange={(date) => {
                  // Store as YYYY-MM-DD string to avoid timezone/type issues
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  setSelectedDate(`${y}-${m}-${d}`);
                }}
                value={selectedDate ? new Date(selectedDate + "T00:00:00") : null}
                tileDisabled={({ date }) => {
                  const dateStr = date.toISOString().split("T")[0];
                  return !availableDates.includes(dateStr);
                }}
                className="mx-auto border-2 border-pink-200 rounded-xl overflow-hidden"
              />
            </div>

            {/* Time Options */}
            {selectedDate && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select New Time:
                </label>
                {timeOptions.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No available times for this date
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {timeOptions.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3 px-4 rounded-lg border-2 font-semibold transition ${
                          selectedTime === time
                            ? "bg-pink-500 text-white border-pink-500"
                            : "bg-white text-gray-700 border-gray-300 hover:border-pink-300"
                        }`}
                      >
                        {to12h(time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={handleConfirmReschedule}
              disabled={!selectedDate || !selectedTime || loading}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold py-4 rounded-xl hover:from-pink-600 hover:to-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Rescheduling..." : "Confirm Reschedule"}
            </button>

            <div className="mt-6 text-center">
              <button
                onClick={() => setStep(2)}
                className="text-pink-600 hover:underline text-sm"
              >
                ← Back to Booking Details
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation */}
        {step === 4 && booking && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-pink-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-green-600 mb-2">
                Rescheduled! 🎉
              </h2>
              <p className="text-gray-600">
                Your appointment has been successfully rescheduled
              </p>
            </div>

            <div className="bg-pink-50 rounded-xl p-6 mb-6">
              <h3 className="font-bold text-pink-700 mb-4">New Appointment:</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-bold text-gray-900">
                    {formatDateShort(booking.date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-bold text-gray-900">
                    {to12h(booking.start_time)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-blue-800 text-sm">
                📧 A confirmation email has been sent to your email
                {booking.email && `: ${booking.email}`}
                <br />
                📱 You'll also receive an SMS confirmation shortly
              </p>
            </div>

            <div className="text-center space-y-4">
              <Link
                href="/"
                className="block w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold py-4 rounded-xl hover:from-pink-600 hover:to-rose-600 transition"
              >
                Back to Home
              </Link>

              <a
                href="https://instagram.com/myasnailsbaby"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-pink-600 hover:underline text-sm"
              >
                DM @myasnailsbaby with questions
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}