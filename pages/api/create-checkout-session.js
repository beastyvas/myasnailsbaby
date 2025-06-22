// File: /pages/api/create-checkout-session.js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const {
      bookingId,
      bookingMetadata
    } = req.body;

    const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  line_items: [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: "Nail Deposit",
          description: "Non-refundable $20 deposit to confirm appointment.",
        },
        unit_amount: 2000,
      },
      quantity: 1,
    },
  ],
  mode: "payment",
  success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${req.headers.origin}/cancel`,
  metadata: {
  booking_id: String(bookingId),
  name: String(bookingMetadata.name || ""),
  instagram: String(bookingMetadata.instagram || ""),
  phone: String(bookingMetadata.phone || ""),
  service: String(bookingMetadata.service || ""),
  artLevel: String(bookingMetadata.artLevel || ""),
  date: String(bookingMetadata.date || ""),
  time: String(bookingMetadata.time || ""),
  notes: String(bookingMetadata.notes || ""),
  returning: String(bookingMetadata.returning || ""),
  referral: String(bookingMetadata.referral || ""),
}

});

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
