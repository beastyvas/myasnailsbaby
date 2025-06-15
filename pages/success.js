import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session_id) return;

    const confirmPayment = async () => {
      try {
        const res = await fetch(`/api/confirm-payment?session_id=${session_id}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error || "Confirmation failed");
      } catch (err) {
        console.error("Failed to confirm payment:", err);
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, [session_id]);

  return (
    <main className="min-h-screen flex items-center justify-center text-center p-6">
      {loading ? (
        <p>Confirming your booking...</p>
      ) : (
        <div>
          <h1 className="text-2xl font-bold">Payment Successful! 🎉</h1>
          <p className="mt-2">Your appointment has been confirmed.</p>
        </div>
      )}
    </main>
  );
}
