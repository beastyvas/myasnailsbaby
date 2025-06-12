import { buffer } from 'micro';
import Stripe from 'stripe';
import { supabase } from '@/utils/supabaseClient';

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata.booking_id;

    const { error } = await supabase
      .from('bookings')
      .update({ paid: true })
      .eq('id', bookingId);

    if (error) {
      console.error('Supabase update failed:', error.message);
    } else {
      console.log(`✅ Booking ${bookingId} marked as paid.`);
    }
  }

  res.status(200).json({ received: true });
}
