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
  event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
} catch (err) {
  console.error("Webhook signature error:", err.message);
  return res.status(400).send(`Webhook Error: ${err.message}`);
}


  // ✅ Handle session completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const bookingId = session.metadata?.booking_id;

    if (!bookingId) {
      console.error("❌ Missing booking_id in metadata");
      return res.status(400).send("Missing booking ID");
    }

    const { error } = await supabase
      .from("bookings")
      .update({ paid: true })
      .eq("id", bookingId);

    if (error) {
      console.error("❌ Supabase update failed:", error.message);
      return res.status(500).send("Failed to update booking status");
    }

    console.log("✅ Booking marked as paid:", bookingId);
  }

  return res.status(200).json({ received: true });
}
