// File: /pages/api/confirm-payment.js
import Stripe from "stripe";
import { supabase } from "@/utils/supabaseClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const { session_id } = req.body;
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const bookingId = session?.metadata?.booking_id;
    if (!bookingId) return res.status(400).json({ success: false, error: "No booking_id found." });

    const { error } = await supabase
      .from("bookings")
      .update({ paid: true })
      .eq("id", bookingId);

    if (error) {
      console.error("Failed to mark paid:", error.message);
      return res.status(500).json({ success: false });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Stripe session error:", err.message);
    res.status(500).json({ success: false });
  }
}
