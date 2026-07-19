"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

export default function CancelAppointmentPage() {
  const [step, setStep] = useState(1); // 1=phone, 2=confirm, 3=done
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refundIssued, setRefundIssued] = useState(false);

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
      console.error(err);
      toast.error("Failed to lookup booking");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          booking_id: booking.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to cancel appointment");
        setLoading(false);
        return;
      }

      setRefundIssued(data.refund_issued);
      setStep(3);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hoursUntil = booking?.hours_until ?? 0;
  const refundEligible = hoursUntil > 48 && booking?.paid;

  const inputCls =
    "w-full px-4 py-3 border border-cream-300 focus:border-cream-900 focus:outline-none focus:ring-0 transition text-cream-900 placeholder-cream-400 bg-white";

  return (
    <main className="min-h-screen bg-cream-50">
      <Toaster position="top-center" />

      <header className="bg-white border-b border-cream-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-cream-900" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Mya&apos;s Nails <span className="italic text-gold-700">Baby</span>
          </Link>
          <Link href="/" className="text-sm text-cream-500 hover:text-cream-900 transition">
            ← Back to Home
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-cream-900 mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Cancel Appointment
          </h1>
          <p className="text-cream-500 text-sm">Cancel your upcoming appointment</p>
        </div>

        {/* STEP 1: Phone Lookup */}
        {step === 1 && (
          <div className="bg-white border border-cream-200 p-8">
            <h2 className="text-xs font-semibold text-cream-500 uppercase tracking-wider mb-6">
              Find Your Booking
            </h2>
            <p className="text-cream-700 text-sm mb-6">
              Enter the phone number you used when booking:
            </p>
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
                className={`w-full py-3 font-medium text-sm tracking-wide transition ${
                  loading
                    ? "bg-cream-300 text-cream-500 cursor-not-allowed"
                    : "bg-gold-700 hover:bg-gold-800 text-white"
                }`}
              >
                {loading ? "Searching..." : "FIND MY BOOKING"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Confirm Cancellation */}
        {step === 2 && booking && (
          <div className="bg-white border border-cream-200 p-8 space-y-6">
            <h2 className="text-xs font-semibold text-cream-500 uppercase tracking-wider">
              Your Appointment
            </h2>

            <div className="space-y-3">
              {[
                ["Name", booking.name],
                [
                  "Service",
                  `${booking.service}${
                    booking.pedicure_type && booking.pedicure_type !== "N/A"
                      ? ` + ${booking.pedicure_type}`
                      : ""
                  }`,
                ],
                ["Date", formatDateShort(booking.date)],
                ["Time", to12h(booking.start_time)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2 border-b border-cream-100"
                >
                  <span className="text-xs font-semibold text-cream-500 uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="font-medium text-cream-900 text-sm">{value}</span>
                </div>
              ))}
            </div>

            {/* Refund notice */}
            {refundEligible ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-emerald-800 text-sm font-medium">
                  Your $20 deposit will be refunded.
                </p>
                <p className="text-emerald-700 text-xs mt-1">
                  Refunds typically appear in 5–10 business days.
                </p>
              </div>
            ) : booking?.paid ? (
              <div className="bg-amber-50 border border-amber-200 p-4">
                <p className="text-amber-800 text-sm font-medium">
                  Your $20 deposit will not be refunded.
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  Cancellations within 48 hours of the appointment are non-refundable.
                </p>
              </div>
            ) : null}

            <div className="bg-cream-50 border border-cream-200 p-4">
              <p className="text-cream-700 text-sm">
                This action cannot be undone. Your time slot will be released and you will
                receive a confirmation text.
              </p>
            </div>

            <button
              onClick={handleCancel}
              disabled={loading}
              className={`w-full py-3 font-medium text-sm tracking-wide transition ${
                loading
                  ? "bg-cream-300 text-cream-500 cursor-not-allowed"
                  : "bg-cream-900 hover:bg-cream-800 text-white"
              }`}
            >
              {loading ? "Cancelling..." : "CONFIRM CANCELLATION"}
            </button>

            <div className="text-center">
              <button
                onClick={() => {
                  setStep(1);
                  setBooking(null);
                  setPhone("");
                }}
                className="text-sm text-cream-500 hover:text-cream-900 transition"
              >
                ← Search different number
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && (
          <div className="bg-white border border-cream-200 p-8 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-cream-900 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2
                className="text-2xl font-bold text-cream-900 mb-1"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Appointment Cancelled
              </h2>
              <p className="text-cream-500 text-sm">
                Your appointment has been successfully cancelled
              </p>
            </div>

            {refundIssued ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
                <p className="font-medium">$20 refund initiated.</p>
                <p className="text-emerald-700 text-xs mt-1">
                  Allow 5–10 business days for the refund to appear.
                </p>
              </div>
            ) : booking?.paid ? (
              <div className="bg-cream-50 border border-cream-200 p-4 text-sm text-cream-700">
                <p>Your $20 deposit was not refunded (cancelled within 48 hours).</p>
              </div>
            ) : null}

            <div className="bg-cream-50 border border-cream-200 p-4 text-sm text-cream-700">
              <p>A confirmation text has been sent to your phone.</p>
            </div>

            <Link
              href="/"
              className="block w-full bg-gold-700 hover:bg-gold-800 text-white py-3 font-medium text-sm tracking-wide transition text-center"
            >
              BACK TO HOME
            </Link>

            <div className="text-center">
              <a
                href="https://instagram.com/myasnailsbaby"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cream-500 hover:text-cream-900 transition"
              >
                DM @myasnailsbaby with questions
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
