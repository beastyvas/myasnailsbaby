import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session_id) return;

    const confirmPayment = async () => {
      const res = await fetch("/api/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });

      if (res.ok) {
        setLoading(false);
      } else {
        console.error("Payment confirm failed");
      }
    };

    confirmPayment();
  }, [session_id]);

  return (
  <main className="min-h-screen flex items-center justify-center bg-pink-50 text-center p-6">
    {loading ? (
      <p className="text-gray-700">Confirming your booking...</p>
    ) : (
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-pink-700">Payment Successful! 🎉</h1>
        <p className="text-gray-800">Your appointment has been confirmed.</p>

        <div className="bg-white border mt-6 rounded-lg p-5 shadow-sm text-left text-sm text-gray-700">
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
      </div>
    )}
  </main>
);

}
