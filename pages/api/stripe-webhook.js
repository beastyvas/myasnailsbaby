import { buffer } from "micro";
import Stripe from "stripe";
import { supabase } from "@/utils/supabaseClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 💳 Only listen to successful payment intents
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    // Get metadata we passed in checkout session
    const { booking_id } = paymentIntent.metadata;

    if (!booking_id) {
      console.error("No booking ID found in metadata");
      return res.status(400).send("Missing booking ID");
    }

    const { error } = await supabase
      .from("bookings")
      .update({ paid: true })
      .eq("id", booking_id);

    if (error) {
      console.error("Failed to update booking:", error.message);
      return res.status(500).send("Failed to update booking");
    }

    console.log("✅ Booking marked as paid:", booking_id);
  }

  res.json({ received: true });
}
