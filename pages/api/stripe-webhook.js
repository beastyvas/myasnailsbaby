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
      duration,
      pedicure,
      pedicure_type,
      booking_nails,
      start_time,
      date,
    } = metadata;

    const safeDate = date?.trim() || null;
    const safeStart = start_time?.trim() || null;

    if (!safeDate || !safeStart) {
      console.error("❌ Missing date or start_time:", { safeDate, safeStart });
      return res.status(400).send("Missing date or start_time");
    }

    // Generate end_time from start_time + duration
    const startHour = parseInt(safeStart.replace(/AM|PM/, ""));
    const isPM = safeStart.includes("PM") && startHour !== 12;
    const isAM = safeStart.includes("AM") && startHour === 12;
    const start24 = isPM ? startHour + 12 : isAM ? 0 : startHour;
    const endHour = start24 + (parseInt(duration) || 2);
    const endSuffix = endHour >= 12 ? "PM" : "AM";
    const endDisplay = `${endHour % 12 === 0 ? 12 : endHour % 12}${endSuffix}`;

    // Check for duplicate
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("phone", phone)
      .eq("date", safeDate)
      .eq("start_time", safeStart);

    if (existing && existing.length > 0) {
      console.log("⚠️ Booking already exists, skipping insert");
      return res.status(200).json({ success: true, bookingId: existing[0].id });
    }

    // Insert into Supabase
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
          start_time: safeStart,
          end_time: endDisplay,
          notes,
          soakoff,
          returning,
          duration,
          referral,
          paid: true,
          pedicure,
          pedicure_type,
          booking_nails,
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
        body: JSON.stringify({ name, date: safeDate, start_time: safeStart }),
      });

      console.log("✅ Booking inserted & SMS sent");
    } catch (smsErr) {
      console.error("⚠️ SMS sending failed:", smsErr.message);
    }

    return res.status(200).json({ received: true });
  }

  res.status(200).json({ received: true });
}
