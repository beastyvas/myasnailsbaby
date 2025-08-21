// File: /pages/api/confirm-payment.js   (JS version)
import Stripe from "stripe";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// SERVICE ROLE (server-only) so RLS can't block updates/inserts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// keep same helpers as webhook if you need to normalize
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
  const d = new Date(Date.UTC(2000,0,1,h,m||0,0));
  d.setUTCHours(d.getUTCHours() + Number(hrs||2));
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}:00`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    // 1) Get the session to build email/SMS text & fallback insert payload
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const md = session.metadata || {};
    const safeDate = md.date?.trim() || null;
    const startLabel = md.start_time?.trim() || null;
    const start24 = startLabel ? to24h(startLabel) : null;
    const end24 = start24 ? addHours(start24, md.duration || 2) : null;

    // 2) Find booking by session_id first (idempotent + no AM/PM mismatch)
    let { data: booking, error: findErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle();

    // 3) If webhook hasn’t inserted yet, do a safe UPSERT (one-time fallback)
    if (!booking) {
      const insert = {
        name: md.name ?? null,
        instagram: md.instagram ?? null,
        phone: md.phone ?? null,
        service: md.service ?? null,
        art_level: md.artLevel ?? null,
        length: md.length ?? null,
        date: safeDate,
        start_time: start24, // normalized
        end_time: end24,
        notes: md.notes ?? null,
        soakoff: md.soakoff ?? null,
        returning: md.returning ?? null,
        duration: md.duration ?? null,
        referral: md.referral ?? null,
        pedicure: md.pedicure ?? null,
        pedicure_type: md.pedicure_type ?? null,
        booking_nails: md.booking_nails ?? null,
        paid: session.payment_status === "paid",
        confirmed: session.payment_status === "paid",
        session_id,
      };

      const { data: upserted, error: upErr } = await supabase
        .from("bookings")
        .upsert(insert, { onConflict: "session_id" }) // requires unique index on session_id (we added earlier)
        .select("*")
        .maybeSingle();

      if (upErr) {
        console.error("❌ upsert failed", upErr);
        return res.status(500).json({ success: false });
      }
      booking = upserted;
    }

    // 4) Mark confirmed (idempotent)
    if (booking && !booking.confirmed && session.payment_status === "paid") {
      await supabase.from("bookings").update({ confirmed: true }).eq("id", booking.id);
    }

    // 5) Send email (Mya)
    try {
      await resend.emails.send({
        from: "Mya's Nails <onboarding@resend.dev>",
        to: ["myasnailsbaby@gmail.com"],
        subject: "New Booking 💅",
        html:` <h2>New Booking Request!</h2> <p><strong>Name:</strong> ${md.name}</p>
         <p><strong>Instagram:</strong> ${instagram}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""} 
          <p><strong>Booking Nails?:</strong> ${booking_nails}</p> 
          <p><strong>Service:</strong> ${service}</p>
           <p><strong>Pedicure Type:</strong> ${pedicure_type}</p>
            <p><strong>Art Level:</strong> ${artLevel}</p>
             <p><strong>Length:</strong> ${length}</p> 
             <p><strong>Soak-Off:</strong> ${soakoff}</p> 
             <p><strong>Date:</strong> ${date}</p>
              <p><strong>Duration (hrs):</strong> ${duration}</p>
               <p><strong>Start Time:</strong> ${start_time}</p>
                <p><strong>Notes:</strong> ${notes}</p>
                 <p><strong>Returning Client:</strong> ${returning}</p>
                  ${referral ? `<p><strong>Referral:</strong> ${referral}</p>` : ""} `,
      });
    } catch (e) {
      console.error("❌ email failed", e?.message || e);
    }

    // 6) SMS (client)
    if (md.phone && session.payment_status === "paid") {
      try {
        const r = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            phone: md.phone.startsWith("+1") ? md.phone : `+1${md.phone}`,
            message: `Hey love! Your appointment is confirmed for ${booking?.date ?? safeDate} at ${startLabel || "your selected time"} 💅`,
            key: process.env.TEXTBELT_API_KEY,
          }),
        });
        const j = await r.json();
        if (!j.success) console.error("❌ textbelt failed", j);
      } catch (e) {
        console.error("❌ sms error", e?.message || e);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ confirm-payment error", err?.message || err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
