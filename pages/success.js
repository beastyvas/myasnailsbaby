import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [loading, setLoading] = useState(true);
  const [wasConfirmed, setWasConfirmed] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { 
      month: "numeric", 
      day: "numeric", 
      year: "2-digit" 
    });
  };

  // Helper to format time to 12hr
  const formatTime = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}${suffix}`;
  };

  useEffect(() => {
    if (!session_id) return;

    const alreadyConfirmed = localStorage.getItem(`confirmed_${session_id}`);
    const savedDetails = localStorage.getItem(`booking_details_${session_id}`);

    if (alreadyConfirmed && savedDetails) {
      console.log("✅ Already confirmed — using saved details");
      setWasConfirmed(true);
      setBookingDetails(JSON.parse(savedDetails));
      setLoading(false);

      setTimeout(() => {
        router.replace("/");
      }, 5000);
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
          
          // Fetch booking details from Stripe session metadata
          const stripeRes = await fetch(`/api/get-session-details?session_id=${session_id}`);
          const stripeData = await stripeRes.json();
          
          if (stripeData.metadata) {
            const details = {
              service: stripeData.metadata.service || "Nail Service",
              date: stripeData.metadata.date,
              start_time: stripeData.metadata.start_time,
            };
            setBookingDetails(details);
            localStorage.setItem(`booking_details_${session_id}`, JSON.stringify(details));
          }
          
          setLoading(false);
        } else {
          console.error("❌ Payment confirmation failed");
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ Confirm-payment error:", err.message);
        setLoading(false);
      }
    };

    confirmPayment();
  }, [session_id, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 text-center p-6">
      {loading ? (
        <div className="space-y-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-700 font-medium">Confirming your booking...</p>
        </div>
      ) : (
        <div className="max-w-xl mx-auto space-y-6">
          {/* Main Success Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-pink-300">
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">
                Payment Successful! 🎉
              </h1>
              <p className="text-gray-600">Your appointment is confirmed</p>
            </div>

            {/* Booking Details */}
            {bookingDetails && (
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-6 mb-6 border-2 border-pink-200">
                <h2 className="text-lg font-bold text-pink-700 mb-4">📋 Booking Details</h2>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Service:</span>
                    <span className="text-gray-900 font-bold">{bookingDetails.service}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Date:</span>
                    <span className="text-gray-900 font-bold">{formatDate(bookingDetails.date)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Time:</span>
                    <span className="text-gray-900 font-bold">{formatTime(bookingDetails.start_time)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-pink-200 mt-2">
                    <span className="text-gray-600 font-medium">Deposit Paid:</span>
                    <span className="text-green-600 font-bold">$20 ✓</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-yellow-800 font-medium">
                📸 <strong>Screenshot this page</strong> for your records!
              </p>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p>📍 2080 E. Flamingo Rd. Suite #106 Room 4</p>
              <p>📱 DM <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-pink-600 font-semibold underline">@myasnailsbaby</a> with questions</p>
            </div>
          </div>

          {/* Policies Card */}
          <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-lg text-left text-sm text-gray-700">
            <h2 className="text-lg font-semibold mb-4 text-pink-700">📌 Important Policies</h2>
            <ul className="space-y-3">
              <li>
                <strong>Booking an Appt.</strong><br />
                All appointments require a $20 deposit (non-refundable) to secure your spot.
              </li>
              <li>
                <strong>No Show / Cancellation</strong><br />
                Cancel at least 48 hours ahead for no penalty (deposit goes toward next appt).<br />
                No-shows or last-minute cancellations are charged 50% of your service.
              </li>
              <li>
                <strong>Late to Appt.</strong><br />
                5 minute grace period if you communicate your ETA. After that = $10 late fee.<br />
                If needed, your service may be shortened to stay on schedule.
              </li>
              <li>
                <strong>Squeeze Ins</strong><br />
                Booking outside regular hours is a squeeze-in and costs 50% extra.
              </li>
              <li>
                <strong>Nail Fix</strong><br />
                Free within 5 days of service. After that: $10 per nail.
              </li>
              <li>
                <strong>No Guests</strong><br />
                No guests are allowed unless both are receiving services at the same time.
              </li>
            </ul>
            <p className="mt-5 text-center font-medium">
              💬 DM <a href="https://instagram.com/myasnailsbaby" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">@myasnailsbaby</a> with any questions or concerns!
            </p>
          </div>

          {wasConfirmed && (
            <p className="text-sm text-gray-500 mt-3">
              Redirecting you to the home page in a few seconds...
            </p>
          )}
        </div>
      )}
    </main>
  );
}