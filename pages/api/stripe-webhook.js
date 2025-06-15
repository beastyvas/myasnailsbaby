// File: /pages/api/stripe-webhook.js
import { buffer } from "micro";
import Stripe from "stripe";
import { supabase } from "@/utils/supabaseClient";

export const config = {
  api: {
    bodyParser: false, // ✅ VERY IMPORTANT
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  let event;
  const sig = req.headers["stripe-signature"];

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Confirm webhook type
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const booking_id = session.metadata?.booking_id;

    if (!booking_id) {
      console.error("❌ No booking ID in metadata");
      return res.status(400).send("Missing booking ID");
    }

    const { error } = await supabase
      .from("bookings")
      .update({ paid: true })
      .eq("id", booking_id);

    if (error) {
      console.error("❌ Failed to update booking:", error.message);
      return res.status(500).send("Database update failed");
    }

    console.log("✅ Booking marked as paid:", booking_id);
  }

  return res.status(200).json({ received: true });
}
