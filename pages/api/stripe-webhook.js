// File: /pages/api/stripe-webhook.js
import { buffer } from "micro";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: false }, // ✅ raw body for Stripe signature verification
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ✅ SERVICE ROLE client (server-only). Do NOT use your public supabaseClient here.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- helpers ---
function to24h(timeLabel) {
  if (!timeLabel) return null;
  
  // If already in 24h format (HH:MM), return with seconds
  if (/^\d{2}:\d{2}$/.test(timeLabel)) {
    return `${timeLabel}:00`;
  }
  
  // Handle 12h format (8AM, 2:30PM, etc.)
  const m = String(timeLabel).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3].toUpperCase();
  
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  
  const hh = String(h).padStart(2, "0");
  const mm = String(min).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function addHoursTo24h(start24, hours) {
  const [h, m] = start24.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m || 0, 0)); // dummy date
  d.setUTCHours(d.getUTCHours() + (Number(hours) || 2));
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

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
    const md = session.metadata || {};

    // Basic validation
    const safeDate = md.date?.trim();
    const safeStartLabel = md.start_time?.trim(); // "8AM"
    if (!safeDate || !safeStartLabel) {
      console.error("❌ Missing date or start_time in metadata:", md);
      return res.status(200).json({ received: true }); // ack so Stripe stops retrying
    }

    // Convert to 24h for DB (your columns are type 'time')
    const start24 = to24h(safeStartLabel);
    if (!start24) {
      console.error("❌ Could not parse start_time:", safeStartLabel);
      return res.status(200).json({ received: true });
    }
    const end24 = addHoursTo24h(start24, md.duration || 2);

    // Idempotency: if we already inserted for this session, bail early
    const { data: existingRow, error: existingErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("session_id", session.id)
      .maybeSingle();
    if (existingErr) console.error("⚠️ session lookup error:", existingErr.message);
    if (existingRow) {
      console.log("ℹ️ Booking already exists for session:", session.id);
      return res.status(200).json({ received: true });
    }

   // start24 and end24 are "HH:MM:SS" strings you already compute
const { data: conflicts, error: conflictError } = await supabase
  .rpc("bookings_conflict", {
    p_date: safeDate,
    p_start: start24,
    p_end: end24,
  });

if (conflictError) {
  console.error("❌ Conflict check error (RPC):", conflictError);
  return res.status(200).json({ received: true });
}
if (conflicts && conflicts.length > 0) {
  console.warn("⚠️ Time conflict; not inserting. Conflicts:", conflicts);
  return res.status(200).json({ received: true });
}


    // Insert booking (single source of truth). Store session_id to prevent dupes.
    const insert = {
      // columns: adjust to your exact schema
      name: md.name ?? null,
      instagram: md.instagram ?? null,
      phone: md.phone ?? null,
      service: md.service ?? null,
      art_level: md.artLevel ?? null,
      length: md.length ?? null,
      date: safeDate,                   // 'YYYY-MM-DD' (DATE)
      start_time: start24,              // 'HH:MM:SS' (TIME)
      end_time: end24,                  // 'HH:MM:SS' (TIME)
      notes: md.notes ?? null,
      soakoff: md.soakoff ?? null,
      returning: md.returning ?? null,
      duration: md.duration ?? null,
      referral: md.referral ?? null,
      pedicure: md.pedicure ?? null,
      pedicure_type: md.pedicure_type ?? null,
      booking_nails: md.booking_nails ?? null,
      paid: true,
      confirmed: true,
      session_id: session.id,
    };

    const { error: insertErr } = await supabase.from("bookings").insert([insert]);
    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr.message);
      return res.status(200).json({ received: true }); // ack so Stripe stops retrying
    }

    // Optional: fire SMS directly (avoid calling your own API route here)
    try {
      await fetch("https://textbelt.com/text", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          phone: md.phone ?? "",
          message: `✅ Confirmed: ${md.service ?? "Appointment"} on ${safeDate} at ${safeStartLabel}. See you soon!`,
          key: process.env.TEXTBELT_API_KEY,
        }),
      });
    } catch (smsErr) {
      console.error("⚠️ SMS send failed:", smsErr?.message || smsErr);
    }

    return res.status(200).json({ received: true });
  }

  // Always acknowledge unknown events to prevent retries storm
  return res.status(200).json({ received: true });
}
