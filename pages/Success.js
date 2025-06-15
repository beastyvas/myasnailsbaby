import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session_id) return;

    const confirmPayment = async () => {
      try {
        const res = await fetch(`/api/confirm-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id }),
        });

        const json = await res.json();
        if (json.success) {
          setLoading(false);
        } else {
          throw new Error("Could not confirm payment.");
        }
      } catch (err) {
        console.error("Payment confirmation error:", err);
      }
    };

    confirmPayment();
  }, [session_id]);

  return (
    <main className="min-h-screen flex items-center justify-center text-center p-6">
      {loading ? (
        <p>Updating your booking...</p>
      ) : (
        <div>
          <h1 className="text-2xl font-bold">Payment Successful! 🎉</h1>
          <p className="mt-2">Your appointment has been confirmed.</p>
        </div>
      )}
    </main>
  );
}
