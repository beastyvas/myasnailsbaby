import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { booking_id } = req.body;
  if (!booking_id) return res.status(400).json({ error: "Missing booking_id" });

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, name, phone, email, date, stripe_customer_id, stripe_payment_method_id, no_show_charged")
    .eq("id", booking_id)
    .single();

  if (error || !booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.no_show_charged) return res.status(409).json({ error: "No-show fee already charged" });
  if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
    return res.status(422).json({ error: "No card on file for this booking" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2500,
      currency: "usd",
      customer: booking.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `No-show fee — ${booking.name} — appt ${booking.date}`,
    });

    await supabase
      .from("bookings")
      .update({ no_show_charged: true, no_show_fee_amount: 2500 })
      .eq("id", booking_id);

    return res.status(200).json({ success: true, payment_intent_id: paymentIntent.id });
  } catch (err) {
    console.error("No-show charge failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
