import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Seo from "@/components/Seo";

export default function Payment() {
  const router = useRouter();
  const { booking_id } = router.query;

  useEffect(() => {
    if (!booking_id) return;

    const pay = async () => {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking_id }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Could not create checkout session');
      }
    };

    pay();
  }, [booking_id]);

  return (
    <main className="min-h-screen flex items-center justify-center text-center p-6">
      <Seo path="/Payment" noindex title="Payment" description="Redirecting to secure checkout." />
      <h1 className="text-xl">Redirecting to payment...</h1>
    </main>
  );
}
