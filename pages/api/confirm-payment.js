import Stripe from "stripe";
import { Resend } from "resend";
import { supabase } from "@/utils/supabaseClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const metadata = session.metadata || {};

    const {
      name = "N/A",
      instagram = "N/A",
      phone = "",
      service = "N/A",
      artLevel = "N/A",
      date = null,
      start_time = null,
      length = "N/A",
      notes = "",
      returning = "N/A",
      referral = "",
      soakoff = "N/A",
      duration = null,
      pedicure_type = "N/A",
      booking_nails = "N/A",
    } = metadata;

    console.log("📨 Confirm-payment metadata:", metadata);

    // ✅ Send email
    try {
      await resend.emails.send({
        from: "Mya's Nails <onboarding@resend.dev>",
        to: ["myasnailsbaby@gmail.com"],
        subject: "New Booking Request 💅",
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
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Duration (hrs):</strong> ${duration}</p>
          <p><strong>Start Time:</strong> ${start_time}</p>
          <p><strong>Notes:</strong> ${notes}</p>
          <p><strong>Returning Client:</strong> ${returning}</p>
          ${referral ? `<p><strong>Referral:</strong> ${referral}</p>` : ""}
        `,
      });
    } catch (emailErr) {
      console.error("❌ Email send failed:", emailErr.message);
    }

    // ✅ SMS (only if not confirmed)
    if (phone && phone.length >= 10 && session.payment_status === "paid") {
      const { data: existing, error: fetchError } = await supabase
        .from("bookings")
        .select("id, confirmed")
        .eq("phone", phone)
        .eq("date", date)
        .eq("start_time", start_time) // ✅ FIXED HERE
        .maybeSingle();

      if (fetchError) {
        console.error("❌ Failed to check existing booking:", fetchError.message);
        return res.status(500).json({ success: false });
      }

      if (existing?.confirmed) {
        console.log("⚠️ Booking already confirmed. Skipping email/SMS.");
        return res.status(200).json({ success: true });
      }

      // ✅ Send text
      try {
        const smsRes = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone.startsWith("+1") ? phone : `+1${phone}`,
            message: `Hey love! 📅 Your appointment with Mya is confirmed for ${date} at ${start_time}. 
            Please DM @myasnailsbaby if you have questions! 💅
            📍2080 E. Flamingo Rd. Suite #106, Room 4 Las Vegas, NV
            Can’t wait to see you! 💋`,
            key: process.env.TEXTBELT_API_KEY,
          }),
        });

        const smsResult = await smsRes.json();
        if (!smsResult.success) {
          console.error("❌ Textbelt failed:", smsResult);
        }
      } catch (smsErr) {
        console.error("❌ SMS send error:", smsErr.message);
      }

      // ✅ Update booking as confirmed
      await supabase
        .from("bookings")
        .update({ confirmed: true })
        .eq("id", existing.id);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Unexpected confirm-payment error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
