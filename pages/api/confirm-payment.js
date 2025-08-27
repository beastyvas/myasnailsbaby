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

    // 1) Verify session with Stripe first for security
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

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
      pedicure = null,
    } = md;

    const safeDate = dateRaw?.trim() || null;
    const startLabel = startLabelRaw?.trim() || null;

    // 2) Wait for webhook to create booking (retry logic instead of upsert)
    let booking = null;
    let retries = 0;
    const maxRetries = 10; // Wait up to 10 seconds

    while (!booking && retries < maxRetries) {
      const { data, error: findErr } = await supabase
        .from("bookings")
        .select("*")
        .eq("session_id", session_id)
        .maybeSingle();
      
      if (findErr) {
        console.error("booking lookup error:", findErr);
      }

      if (data) {
        booking = data;
        break;
      }

      // Wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }

    if (!booking) {
      console.error("Booking not found after webhook processing for session:", session_id);
      return res.status(500).json({ 
        error: "Booking not found. Please contact support if your payment was charged." 
      });
    }

    // 3) Update booking to confirmed if not already
    if (!booking.confirmed) {
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({ confirmed: true, paid: true })
        .eq("id", booking.id);
      
      if (updateErr) {
        console.error("Failed to confirm booking:", updateErr);
        return res.status(500).json({ error: "Failed to confirm booking" });
      }
    }

    // 4) Send email to Mya
    try {
      await resend.emails.send({
        from: "Mya's Nails <onboarding@resend.dev>",
        to: ["myasnailsbaby@gmail.com"],
        subject: "New Booking Confirmed 💅",
        html: `
          <h2>New Booking Confirmed!</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Instagram:</strong> ${instagram}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
          <p><strong>Booking Nails?:</strong> ${booking_nails}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Pedicure Type:</strong> ${pedicure_type}</p>
          <p><strong>Art Level:</strong> ${artLevel}</p>
          <p><strong>Length:</strong> ${length}</p>
          <p><strong>Soak-Off:</strong> ${soakoff}</p>
          <p><strong>Date:</strong> ${booking.date}</p>
          <p><strong>Duration (hrs):</strong> ${duration ?? "N/A"}</p>
          <p><strong>Start Time:</strong> ${startLabel ?? "N/A"}</p>
          <p><strong>Notes:</strong> ${notes}</p>
          <p><strong>Returning Client:</strong> ${returning}</p>
          ${referral ? `<p><strong>Referral:</strong> ${referral}</p>` : ""}
          <p><strong>Payment Status:</strong> ✅ Paid & Confirmed</p>
        `,
      });
    } catch (emailErr) {
      console.error("Email failed:", emailErr?.message || emailErr);
      // Continue - email failure shouldn't break user flow
    }

    // 5) Send confirmation SMS to client
    if (phone) {
      try {
        const formattedPhone = phone.startsWith("+1") ? phone : `+1${phone}`;
        const smsResponse = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            phone: formattedPhone,
            message: `Hey love! Your appointment with Mya is confirmed for ${booking.date} at ${startLabel || "your selected time"} 💅
📍2080 E. Flamingo Rd. Suite #106, Room 4 Las Vegas, NV
DM @myasnailsbaby if you need anything!`,
            key: process.env.TEXTBELT_API_KEY,
          }),
        });
        
        const smsResult = await smsResponse.json();
        if (!smsResult.success) {
          console.error("SMS failed:", smsResult);
        }
      } catch (smsErr) {
        console.error("SMS error:", smsErr?.message || smsErr);
      }
    }

    return res.status(200).json({ 
      success: true,
      booking_id: booking.id,
      confirmed: true 
    });

  } catch (err) {
    console.error("Confirm payment error:", err?.message || err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}