// /pages/api/confirm-payment.js
import Stripe from "stripe";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// SERVICE ROLE so RLS can't block
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function to24h(label) {
  if (!label) return null;
  const m = String(label).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}
function addHours(start24, hrs = 2) {
  const [h, m] = start24.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m || 0, 0));
  d.setUTCHours(d.getUTCHours() + Number(hrs || 2));
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    // 1) Stripe session + metadata
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const md = session.metadata || {};

    // Destructure ONCE from metadata with safe defaults
    const {
      name = "N/A",
      instagram = "N/A",
      phone = "",
      service = "N/A",
      artLevel = "N/A",
      length = "N/A",
      notes = "",
      returning = "N/A",
      referral = "",
      soakoff = "N/A",
      duration = null,
      pedicure_type = "N/A",
      booking_nails = "N/A",
      start_time: startLabelRaw = null,
      date: dateRaw = null,
      pedicure = null, // if you send this too
    } = md;

    const safeDate = dateRaw?.trim() || null;
    const startLabel = startLabelRaw?.trim() || null;
    const start24 = startLabel ? to24h(startLabel) : null;
    const end24 = start24 ? addHours(start24, duration || 2) : null;

    // 2) Find booking by session_id
    let { data: booking, error: findErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle();
    if (findErr) console.error("lookup_error", findErr);

    // 3) Fallback UPSERT if webhook hasn't inserted yet
    if (!booking) {
      const insert = {
        name,
        instagram,
        phone,
        service,
        art_level: artLevel,
        length,
        date: safeDate,
        start_time: start24,
        end_time: end24,
        notes,
        soakoff,
        returning,
        duration,
        referral,
        pedicure,
        pedicure_type,
        booking_nails,
        paid: session.payment_status === "paid",
        confirmed: session.payment_status === "paid",
        session_id,
      };

      const { data: upserted, error: upErr } = await supabase
        .from("bookings")
        .upsert(insert, { onConflict: "session_id" })
        .select("*")
        .maybeSingle();
      if (upErr) {
        console.error("upsert_failed", upErr);
        return res.status(500).json({ success: false });
      }
      booking = upserted;
    }

    // 4) Ensure confirmed if paid
    if (booking && !booking.confirmed && session.payment_status === "paid") {
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ confirmed: true, paid: true })
        .eq("id", booking.id);
      if (updErr) console.error("confirm_update_failed", updErr);
    }

    // 5) Email to Mya — now using the destructured vars
    try {
      await resend.emails.send({
        from: "Mya's Nails <onboarding@resend.dev>", // make sure this domain is verified in Resend
        to: ["myasnailsbaby@gmail.com"],
        subject: "New Booking 💅",
        html: `
          <h2>New Booking Request!</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Instagram:</strong> ${instagram}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
          <p><strong>Booking Nails?:</strong> ${booking_nails}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Pedicure Type:</strong> ${pedicure_type}</p>
          <p><strong>Art Level:</strong> ${artLevel}</p>
          <p><strong>Length:</strong> ${length}</p>
          <p><strong>Soak-Off:</strong> ${soakoff}</p>
          <p><strong>Date:</strong> ${booking?.date ?? safeDate ?? "N/A"}</p>
          <p><strong>Duration (hrs):</strong> ${duration ?? "N/A"}</p>
          <p><strong>Start Time:</strong> ${startLabel ?? "N/A"}</p>
          <p><strong>Notes:</strong> ${notes}</p>
          <p><strong>Returning Client:</strong> ${returning}</p>
          ${referral ? `<p><strong>Referral:</strong> ${referral}</p>` : ""}
        `,
      });
    } catch (e) {
      console.error("❌ email failed", e?.message || e);
      // continue; not fatal for user flow
    }

    // 6) SMS to client (optional)
    if (phone && session.payment_status === "paid") {
      try {
        const r = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            phone: phone.startsWith("+1") ? phone : `+1${phone}`,
            message: `Hey love! Your appointment with Mya is confirmed for ${booking?.date ?? safeDate} at ${startLabel || "your selected time"} 💅
📍2080 E. Flamingo Rd. Suite #106, Room 4 Las Vegas, NV
DM @myasnailsbaby if you need anything!`,
            key: process.env.TEXTBELT_API_KEY,
          }),
        });
        const j = await r.json();
        if (!j.success) console.error("textbelt_failed", j);
      } catch (e) {
        console.error("sms_error", e?.message || e);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ confirm-payment error", err?.message || err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
