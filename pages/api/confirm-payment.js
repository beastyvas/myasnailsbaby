// /pages/api/confirm-payment.js
import Stripe from "stripe";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// SERVICE ROLE so RLS can't block
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function to12h(time24) {
  if (!time24) return "your selected time";
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr}${suffix}`;
}

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
      email: clientEmail = null,
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
        // If auto-refunded due to conflict, return a clear message
        if (data.refunded) {
          return res.status(409).json({
            error: "time_conflict",
            message: "Sorry, that time slot was just booked by someone else. You have been fully refunded. Please book a different time.",
          });
        }
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
      const emailResult = await resend.emails.send({
        // ⚠️ CHANGE THIS: Use your verified domain or verified email
        // Option 1 (with domain): from: "Mya's Nails <bookings@yourdomain.com>"
        // Option 2 (without domain): from: "myasnailsbaby@gmail.com"
        from: process.env.RESEND_FROM_EMAIL || "myasnailsbaby@gmail.com",
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
      console.log("✅ Email sent to Mya:", emailResult.id);
    } catch (emailErr) {
      console.error("❌ Email to Mya failed:", emailErr?.message || emailErr);
      // Continue - email failure shouldn't break user flow
    }

    // 5) Send confirmation email to client
    if (clientEmail) {
      try {
        const displayTime = booking.start_time ? to12h(booking.start_time) : "your selected time";
        const clientEmailResult = await resend.emails.send({
          // ⚠️ CHANGE THIS: Use your verified domain or verified email
          from: process.env.RESEND_FROM_EMAIL || "myasnailsbaby@gmail.com",
          to: [clientEmail],
          subject: "Your Appointment is Confirmed 💅",
          html: `
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #f0e6f0;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #e91e8c, #f06292); padding: 36px 32px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 26px; letter-spacing: 1px;">Mya's Nails Baby 💅</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">@myasnailsbaby</p>
              </div>

              <!-- Body -->
              <div style="padding: 32px;">
                <h2 style="color: #c2185b; margin: 0 0 8px;">You're all booked, love! ✨</h2>
                <p style="color: #555; margin: 0 0 24px; font-size: 15px;">Hey ${name}! Your appointment is confirmed. Here are your details:</p>

                <!-- Booking Details Card -->
                <div style="background: #fdf2f8; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #999; font-size: 13px; width: 40%;">📅 Date</td>
                      <td style="padding: 8px 0; color: #333; font-weight: bold; font-size: 14px;">${booking.date}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #999; font-size: 13px;">⏰ Time</td>
                      <td style="padding: 8px 0; color: #333; font-weight: bold; font-size: 14px;">${displayTime}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #999; font-size: 13px;">💅 Service</td>
                      <td style="padding: 8px 0; color: #333; font-weight: bold; font-size: 14px;">${service}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #999; font-size: 13px;">💰 Deposit</td>
                      <td style="padding: 8px 0; color: #333; font-weight: bold; font-size: 14px;">$20 ✅ Paid</td>
                    </tr>
                  </table>
                </div>

                <!-- Location -->
                <div style="background: #fff8e1; border-left: 4px solid #f06292; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                  <p style="margin: 0; color: #555; font-size: 14px;"><strong style="color: #c2185b;">📍 Location</strong><br>
                  2080 E. Flamingo Rd., Suite #106, Room 4<br>Las Vegas, NV</p>
                </div>

                <!-- Policy reminder -->
                <p style="color: #888; font-size: 13px; margin: 0 0 24px;">
                  Please remember the $20 deposit is <strong>non-refundable</strong>. If you need to reschedule, DM Mya at least 48 hours in advance.
                </p>

                <!-- CTA -->
                <div style="text-align: center; margin-bottom: 24px;">
                  <a href="https://instagram.com/myasnailsbaby"
                     style="display: inline-block; background: linear-gradient(135deg, #e91e8c, #f06292); color: #fff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 15px;">
                    DM @myasnailsbaby 💬
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: #fdf2f8; padding: 20px 32px; text-align: center; border-top: 1px solid #f0e6f0;">
                <p style="margin: 0; color: #bbb; font-size: 12px;">Mya's Nails Baby · Las Vegas, NV · @myasnailsbaby</p>
              </div>
            </div>
          `,
        });
        console.log("✅ Confirmation email sent to client:", clientEmail, "ID:", clientEmailResult.id);
      } catch (clientEmailErr) {
        console.error("❌ Client email failed:", clientEmailErr?.message || clientEmailErr);
        // Don't fail the whole request if email fails
      }
    }

    // 6) Send confirmation SMS to client via Twilio
    if (phone) {
      try {
        const displayTime = booking.start_time ? to12h(booking.start_time) : "your selected time";
        const formattedPhone = phone.startsWith("+1") ? phone : `+1${phone}`;

        await twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
          body: `Hey love! Your appointment with Mya is confirmed for ${booking.date} at ${displayTime} 💅
📍2080 E. Flamingo Rd. Suite #106, Room 4 Las Vegas, NV
DM @myasnailsbaby if you need anything!

Reply STOP to unsubscribe.`,
        });

        console.log("✅ Confirmation SMS sent to:", formattedPhone);
      } catch (smsErr) {
        console.error("❌ SMS error:", smsErr?.message || smsErr);
        // Don't fail the whole request if SMS fails
      }
    }

    return res.status(200).json({ 
      success: true,
      booking_id: booking.id,
      confirmed: true 
    });

  } catch (err) {
    console.error("❌ Confirm payment error:", err?.message || err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}