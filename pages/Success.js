import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

export default function SuccessPage() {
  const router = useRouter();
  const { booking_id } = router.query;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!booking_id) return;

    const markAsPaid = async () => {
      await supabase
        .from('bookings')
        .update({ paid: true })
        .eq('id', booking_id);
      setLoading(false);
    };

    markAsPaid();
  }, [booking_id]);

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
