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

  // Helper: Format time to 12hr
  const to12h = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr = "00"] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr}${suffix}`;
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

  const inputCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 placeholder-stone-400 bg-white";

  return (
    <main className="min-h-screen bg-stone-50">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-stone-900" style={{ fontFamily: "Georgia, serif" }}>MyasNailsBaby</Link>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition">← Back to Home</Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-stone-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>Reschedule</h1>
          <p className="text-stone-500 text-sm">Update your appointment date or time</p>
        </div>

        {/* STEP 1: Phone Lookup */}
        {step === 1 && (
          <div className="bg-white border border-stone-200 p-8">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-6">Find Your Booking</h2>
            <p className="text-stone-700 text-sm mb-6">Enter the phone number you used when booking:</p>
            <form onSubmit={handleLookup} className="space-y-4">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="7021234567"
                className={inputCls}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 font-medium text-sm tracking-wide transition ${loading ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-rose-800 hover:bg-rose-900 text-white"}`}
              >
                {loading ? "Searching..." : "FIND MY BOOKING"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Show Current Booking */}
        {step === 2 && booking && (
          <div className="bg-white border border-stone-200 p-8 space-y-6">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Current Appointment</h2>

            <div className="space-y-3">
              {[
                ["Name", booking.name],
                ["Service", `${booking.service}${booking.pedicure_type && booking.pedicure_type !== "N/A" ? ` + ${booking.pedicure_type}` : ""}`],
                ["Date", formatDateShort(booking.date)],
                ["Time", to12h(booking.start_time)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-stone-100">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{label}</span>
                  <span className="font-medium text-stone-900 text-sm">{value}</span>
                </div>
              ))}
            </div>

            {booking.can_reschedule ? (
              <>
                <div className="bg-stone-50 border border-stone-200 p-4">
                  <p className="text-stone-700 text-sm">
                    You can reschedule this appointment.
                    {booking.reschedule_count > 0 && (
                      <span className="block text-stone-500 text-xs mt-1">
                        Rescheduled {booking.reschedule_count} time(s) — {2 - booking.reschedule_count} remaining.
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleStartReschedule}
                  className="w-full bg-rose-800 hover:bg-rose-900 text-white py-3 font-medium text-sm tracking-wide transition"
                >
                  CHOOSE NEW DATE & TIME
                </button>
              </>
            ) : (
              <div className="bg-stone-50 border border-stone-200 p-6">
                <h3 className="font-semibold text-stone-900 mb-2 text-sm">Cannot Reschedule Online</h3>
                <p className="text-stone-700 text-sm mb-4">
                  {(booking.reschedule_count || 0) >= 2
                    ? "You've reached the maximum of 2 reschedules for this booking."
                    : "Your appointment is less than 48 hours away. Online rescheduling is no longer available."}
                </p>
                <p className="text-stone-700 text-sm">
                  Please DM{" "}
                  <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-rose-800 hover:underline font-medium">
                    @myasnailsbaby
                  </a>{" "}
                  on Instagram or call (702) 981-8428.
                </p>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => { setStep(1); setBooking(null); setPhone(""); }}
                className="text-sm text-stone-500 hover:text-stone-900 transition"
              >
                ← Search different number
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Pick New Date/Time */}
        {step === 3 && booking && (
          <div className="bg-white border border-stone-200 p-8 space-y-6">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Choose New Appointment</h2>

            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Select Date</p>
              <div className="calendar-wrapper border border-stone-200 p-4">
                <Calendar
                  onChange={(date) => {
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
                  tileClassName={({ date }) => {
                    const iso = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
                    return selectedDate === iso ? "selected-date-clean" : availableDates.includes(iso) ? "available-date-clean" : null;
                  }}
                  calendarType="US"
                  className="w-full"
                />
              </div>
            </div>

            {selectedDate && (
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Select Time</p>
                {timeOptions.length === 0 ? (
                  <p className="text-stone-500 text-sm">No available times for this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {timeOptions.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`py-3 px-4 border text-sm font-medium transition ${
                          selectedTime === t
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-white text-stone-700 border-stone-300 hover:border-stone-900"
                        }`}
                      >
                        {to12h(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleConfirmReschedule}
              disabled={!selectedDate || !selectedTime || loading}
              className={`w-full py-3 font-medium text-sm tracking-wide transition ${!selectedDate || !selectedTime || loading ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-rose-800 hover:bg-rose-900 text-white"}`}
            >
              {loading ? "Rescheduling..." : "CONFIRM RESCHEDULE"}
            </button>

            <div className="text-center">
              <button onClick={() => setStep(2)} className="text-sm text-stone-500 hover:text-stone-900 transition">
                ← Back to booking details
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation */}
        {step === 4 && booking && (
          <div className="bg-white border border-stone-200 p-8 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-stone-900 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>Appointment Rescheduled</h2>
              <p className="text-stone-500 text-sm">Your new appointment is confirmed</p>
            </div>

            <div className="space-y-3">
              {[
                ["New Date", formatDateShort(booking.date)],
                ["New Time", to12h(booking.start_time)],
              ].map(([label, value]) => (
                <div key={label} className="bg-stone-50 border border-stone-200 p-4 flex justify-between items-center">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{label}</span>
                  <span className="font-medium text-stone-900 text-sm">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-stone-50 border border-stone-200 p-4 text-sm text-stone-700 space-y-1">
              <p>A confirmation SMS has been sent to your phone.</p>
              {booking.email && <p>Confirmation email sent to {booking.email}.</p>}
            </div>

            <Link href="/" className="block w-full bg-rose-800 hover:bg-rose-900 text-white py-3 font-medium text-sm tracking-wide transition text-center">
              BACK TO HOME
            </Link>

            <div className="text-center">
              <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-sm text-stone-500 hover:text-stone-900 transition">
                DM @myasnailsbaby with questions
              </a>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
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