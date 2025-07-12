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
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const sig = req.headers["stripe-signature"];
  let event;

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

    console.log("📬 Webhook received for session:", session.id);
    if (!metadata) {
      console.error("❌ Missing metadata");
      return res.status(400).send("Missing metadata");
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
      length,
      returning,
      referral,
    } = metadata;

    // 🔒 Check if booking already exists (by phone, date, time)
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("phone", phone)
      .eq("date", date)
      .eq("time", time);

    if (existing && existing.length > 0) {
      console.log("⚠️ Booking already exists — skipping insert.");
      return res.status(200).json({ alreadyExists: true });
    }

    // ✅ Insert fallback booking
    const { error } = await supabase.from("bookings").insert([
      {
        id: booking_id,
        name,
        instagram,
        phone,
        service,
        art_level: artLevel,
        length,
        date,
        time,
        notes,
        returning,
        referral,
        paid: true,
      },
    ]);

    if (error) {
      console.error("❌ Supabase insert error:", error.message);
      return res.status(500).send("Supabase insert failed");
    }

    // 📲 Optional: Send SMS
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, time }),
      });

      console.log("✅ Booking inserted via webhook & SMS sent");
    } catch (smsErr) {
      console.error("⚠️ SMS sending failed:", smsErr.message);
    }
  }

  return res.status(200).json({ received: true });
}
