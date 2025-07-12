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
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  let event;
  const sig = req.headers["stripe-signature"];

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata;

    console.log("📬 Webhook received with metadata:", metadata);

    if (
      !metadata ||
      typeof metadata.booking_id !== "string" ||
      metadata.booking_id.length < 10
    ) {
      console.error("❌ Invalid metadata or missing booking_id:", metadata);
      return res.status(400).send("Invalid metadata");
    }

    // 🧼 Sanitize date & time
    const safeDate = metadata.date?.trim() || null;
    const safeTime = metadata.time?.trim() || null;

    if (!safeDate || !safeTime) {
      console.error("❌ Missing or invalid date/time:", { safeDate, safeTime });
      return res.status(400).send("Missing date/time");
    }

    const {
      booking_id,
      name,
      instagram,
      phone,
      service,
      artLevel,
      notes,
      length,
      soakoff,
      returning,
      referral,
    } = metadata;

    // Check for duplicate booking
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("phone", phone)
      .eq("date", safeDate)
      .eq("time", safeTime);

    if (existing && existing.length > 0) {
      console.log("⚠️ Booking already exists, skipping insert");
      return res
        .status(200)
        .json({ success: true, bookingId: existing[0].id });
    }

    // Insert sanitized booking
    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          name,
          instagram,
          phone,
          service,
          art_level: artLevel,
          length,
          date: safeDate,
          time: safeTime,
          notes,
          soakoff,
          paid: true,
          returning,
          referral,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", error.message);
      return res.status(500).send("Supabase insert failed");
    }

    // Send confirmation text
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date: safeDate, time: safeTime }),
      });

      console.log("✅ Booking inserted & SMS sent");
    } catch (smsErr) {
      console.error("⚠️ SMS sending failed:", smsErr.message);
    }
  }

  return res.status(200).json({ received: true });
}
