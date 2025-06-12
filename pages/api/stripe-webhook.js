import Stripe from 'stripe';
import { buffer } from 'micro';
import { supabase } from '@/utils/supabaseClient';

export const config = {
  api: {
    bodyParser: false, // ✅ critical!
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-08-15',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    const buf = await buffer(req); // ✅ must pass raw body!
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;

    if (bookingId) {
      const { error } = await supabase
        .from('bookings')
        .update({ paid: true })
        .eq('id', bookingId);

      if (error) {
        console.error('❌ Supabase update error:', error.message);
        return res.status(500).send('Supabase update failed');
      }
    }
  }

  res.status(200).json({ received: true });
}
