// File: /pages/api/stripe-webhook.js
import { buffer } from "micro";
import Stripe from "stripe";
import { supabase } from "@/utils/supabaseClient";

export const config = {
  api: {
    bodyParser: false,
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata;

    if (!metadata || !metadata.booking_id) {
      console.error("❌ Missing metadata or booking_id");
      return res.status(400).send("Invalid metadata");
    }

    const {
  booking_id,
  name,
  instagram,
  phone,
  service,
  artLevel,
  date,
  time,
  notes,
  returning,
  referral
} = session.metadata || {};

const { error } = await supabase.from("bookings").update({
  name,
  instagram,
  phone,
  service,
  art_level: artLevel,      // ✅ key fix here
  date,
  time,
  notes,
  returning,
  referral,
  paid: true,
})
.eq("id", booking_id);


    if (error) {
      console.error("❌ Supabase update error:", error.message);
      return res.status(500).send("Supabase update failed");
    }

    // ✅ Send SMS to Mya
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, time }),
      });

      console.log("✅ Booking updated & SMS sent");
    } catch (smsErr) {
      console.error("⚠️ SMS sending failed:", smsErr.message);
    }
  }

  return res.status(200).json({ received: true });
}
