import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [loading, setLoading] = useState(true);
  const [wasConfirmed, setWasConfirmed] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const formatTime = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr || "00"}${suffix}`;
  };

  useEffect(() => {
    if (!session_id) return;

    const alreadyConfirmed = localStorage.getItem(`confirmed_${session_id}`);
    const savedDetails = localStorage.getItem(`booking_details_${session_id}`);

    if (alreadyConfirmed && savedDetails) {
      setWasConfirmed(true);
      setBookingDetails(JSON.parse(savedDetails));
      setLoading(false);
      setTimeout(() => router.replace("/"), 8000);
      return;
    }

    const confirmPayment = async () => {
      try {
        const res = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem(`confirmed_${session_id}`, "true");
          const stripeRes = await fetch(`/api/get-session-details?session_id=${session_id}`);
          const stripeData = await stripeRes.json();
          if (stripeData.metadata) {
            const md = stripeData.metadata;
            const details = {
              service: md.service || "",
              date: md.date,
              start_time: md.start_time,
              booking_nails: md.booking_nails || "no",
              artLevel: md.artLevel || "",
              length: md.length || "",
              soakoff: md.soakoff || "",
              pedicure: md.pedicure || "no",
              pedicure_type: md.pedicure_type || "",
              notes: md.notes || "",
              duration: md.duration || "",
            };
            setBookingDetails(details);
            localStorage.setItem(`booking_details_${session_id}`, JSON.stringify(details));
          }
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Confirm-payment error:", err.message);
        setLoading(false);
      }
    };

    confirmPayment();
  }, [session_id, router]);

  const getServicesList = () => {
    if (!bookingDetails) return [];
    const services = [];
    if (bookingDetails.booking_nails === "yes" && bookingDetails.service) services.push(bookingDetails.service);
    if (bookingDetails.pedicure === "yes" && bookingDetails.pedicure_type) services.push(bookingDetails.pedicure_type);
    return services;
  };

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      {loading ? (
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-600 text-sm">Confirming your booking...</p>
        </div>
      ) : (
        <div className="w-full max-w-lg space-y-4">

          {/* Success Card */}
          <div className="bg-white border border-stone-200 p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-stone-900 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>
                Booking Confirmed
              </h1>
              <p className="text-stone-500 text-sm">Your appointment is locked in</p>
            </div>

            {bookingDetails && (
              <div className="space-y-4 mb-6">
                {/* Services */}
                {getServicesList().length > 0 && (
                  <div className="bg-stone-50 border border-stone-200 p-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Services</p>
                    {getServicesList().map((s, i) => (
                      <p key={i} className="text-stone-900 font-medium text-sm">{s}</p>
                    ))}
                  </div>
                )}

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-50 border border-stone-200 p-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Date</p>
                    <p className="text-stone-900 font-medium text-sm">{formatDate(bookingDetails.date)}</p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 p-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Time</p>
                    <p className="text-stone-900 font-medium text-sm">{formatTime(bookingDetails.start_time)}</p>
                  </div>
                </div>

                {/* Nail Details */}
                {bookingDetails.booking_nails === "yes" && (bookingDetails.artLevel || bookingDetails.length || bookingDetails.soakoff) && (
                  <div className="bg-stone-50 border border-stone-200 p-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Nail Details</p>
                    <div className="space-y-1 text-sm">
                      {bookingDetails.artLevel && bookingDetails.artLevel !== "N/A" && (
                        <p className="text-stone-700"><span className="text-stone-500">Art Level:</span> <span className="font-medium text-stone-900">{bookingDetails.artLevel}</span></p>
                      )}
                      {bookingDetails.length && bookingDetails.length !== "N/A" && (
                        <p className="text-stone-700"><span className="text-stone-500">Length:</span> <span className="font-medium text-stone-900">{bookingDetails.length}</span></p>
                      )}
                      {bookingDetails.soakoff && bookingDetails.soakoff !== "none" && (
                        <p className="text-stone-700"><span className="text-stone-500">Soak-Off:</span> <span className="font-medium text-stone-900">{bookingDetails.soakoff}</span></p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {bookingDetails.notes && (
                  <div className="bg-stone-50 border border-stone-200 p-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-stone-700 text-sm italic">"{bookingDetails.notes}"</p>
                  </div>
                )}

                {/* Deposit */}
                <div className="border-t border-stone-200 pt-4 flex justify-between items-center">
                  <span className="text-stone-600 text-sm">Deposit Paid</span>
                  <span className="text-stone-900 font-bold">$20 ✓</span>
                </div>
              </div>
            )}

            <div className="bg-stone-50 border border-stone-200 p-4 text-center mb-4">
              <p className="text-stone-700 text-sm font-medium">Screenshot this page for your records</p>
            </div>

            <div className="text-center space-y-1 text-sm text-stone-600">
              <p>2080 E. Flamingo Rd. Suite #106 Room 4 · Las Vegas, NV</p>
              <p>
                DM{" "}
                <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-rose-800 font-medium hover:underline">
                  @myasnailsbaby
                </a>{" "}
                with any questions
              </p>
            </div>
          </div>

          {/* Policies Card */}
          <div className="bg-white border border-stone-200 p-6">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Important Policies</h2>
            <div className="space-y-3 text-sm text-stone-700">
              {[
                ["Deposit", "Non-refundable $20 deposit required. Applied toward your total service."],
                ["Cancellation", "Cancel 48+ hours ahead: deposit credited to next visit. Late/no-show: 50% of service charged."],
                ["Late Arrivals", "5-minute grace period. After that: $10 late fee. Service may be shortened."],
                ["Nail Repairs", "Free within 5 days. After 5 days: $10 per nail."],
                ["No Guests", "Only clients receiving services are permitted."],
              ].map(([title, body]) => (
                <div key={title}>
                  <span className="font-semibold text-stone-900">{title}: </span>
                  <span>{body}</span>
                </div>
              ))}
            </div>
          </div>

          {wasConfirmed && (
            <p className="text-center text-xs text-stone-400">Redirecting to home page shortly...</p>
          )}

          <div className="text-center">
            <Link href="/" className="text-sm text-rose-800 hover:underline font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
