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

    console.log("📦 Creating Stripe Checkout:", { bookingId, bookingMetadata });

    if (!bookingId || typeof bookingId !== "string" || bookingId.length < 10) {
      console.error("❌ Invalid or missing bookingId");
      return res.status(400).json({ error: "Missing bookingId" });
    }

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
        booking_id: bookingId,
        name: bookingMetadata.name,
        instagram: bookingMetadata.instagram,
        phone: bookingMetadata.phone,
        service: bookingMetadata.service,
        artLevel: bookingMetadata.artLevel,
        date: bookingMetadata.date,
        time: bookingMetadata.time,
        notes: bookingMetadata.notes,
        returning: bookingMetadata.returning,
        referral: bookingMetadata.referral,
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe session error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
