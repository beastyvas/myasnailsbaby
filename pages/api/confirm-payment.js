import Stripe from "stripe";
import { supabase } from "@/utils/supabaseClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const { session_id } = req.body;
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const bookingId = session.metadata.booking_id;

    const { error } = await supabase
      .from("bookings")
      .update({ paid: true })
      .eq("id", bookingId);

    if (error) {
      console.error("❌ Failed to update booking:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Stripe confirm error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
