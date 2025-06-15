// File: pages/api/confirm-payment.js
import Stripe from "stripe";
import { supabase } from "@/utils/supabaseClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const booking_id = session.metadata?.booking_id;

    if (!booking_id) {
      return res.status(400).json({ error: "Missing booking_id in metadata" });
    }

    const { error } = await supabase
      .from("bookings")
      .update({ paid: true })
      .eq("id", booking_id);

    if (error) {
      throw new Error(error.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Confirm payment error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
