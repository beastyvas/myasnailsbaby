import Stripe from 'stripe';
import { buffer } from 'micro'; // ✅ required for raw body

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-08-15',
});

export const config = {
  api: {
    bodyParser: false, // ✅ disables Next.js parsing
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let event;
  const sig = req.headers['stripe-signature'];

  try {
    const buf = await buffer(req); // ✅ read raw body
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;

    if (bookingId) {
      const { data, error } = await supabase
        .from('bookings')
        .update({ paid: true })
        .eq('id', bookingId);

      if (error) {
        console.error('❌ Supabase error:', error.message);
        return res.status(500).send('Failed to mark as paid');
      }
    }
  }

  res.status(200).json({ received: true });
}
