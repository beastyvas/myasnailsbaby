// File: /pages/api/create-checkout-session.js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function findOrCreateCustomer({ email, name, phone }) {
  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;
  }
  const customer = await stripe.customers.create({
    name,
    ...(email ? { email } : {}),
    metadata: { phone: phone || "" },
  });
  return customer.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { bookingMetadata } = req.body;

    console.log("📦 Creating Stripe Checkout with metadata:", bookingMetadata);

    if (
      !bookingMetadata?.booking_id ||
      typeof bookingMetadata.booking_id !== "string" ||
      bookingMetadata.booking_id.length < 10
    ) {
      console.error("❌ Invalid or missing booking_id in metadata");
      return res.status(400).json({ error: "Missing or invalid booking_id" });
    }

    let customerId;
    try {
      customerId = await findOrCreateCustomer({
        email: bookingMetadata.email,
        name: bookingMetadata.name,
        phone: bookingMetadata.phone,
      });
    } catch (e) {
      console.error("⚠️ Could not find/create Stripe customer:", e.message);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      ...(customerId ? { customer: customerId } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Nail Deposit",
              description:
                "$20 deposit to confirm your appointment. Refundable if cancelled 48+ hours in advance. By completing this payment you authorize a $25 no-show fee to be charged to this card if you miss your appointment without notice.",
            },
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      mode: "payment",
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: {
  booking_id: bookingMetadata.booking_id,
  name: bookingMetadata.name,
  instagram: bookingMetadata.instagram,
  phone: bookingMetadata.phone,
  service: bookingMetadata.service,
  artLevel: bookingMetadata.artLevel,
  length: bookingMetadata.length,
  date: bookingMetadata.date,
  start_time: bookingMetadata.start_time,
  notes: bookingMetadata.notes,
  soakoff: bookingMetadata.soakoff,
  returning: bookingMetadata.returning,
  pedicure_type: bookingMetadata.pedicure_type,
  duration: bookingMetadata.duration,
  booking_nails: bookingMetadata.booking_nails,
  referral: bookingMetadata.referral,
  pedicure: bookingMetadata.pedicure,
  email: bookingMetadata.email ?? null,
},

    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe session error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}