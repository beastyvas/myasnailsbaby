import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import twilio from "twilio";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function to12h(time24) {
  if (!time24) return "";
  const [hourStr, minuteStr = "00"] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr}${suffix}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone, booking_id } = req.body;

  if (!phone || !booking_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const cleanPhone = String(phone).replace(/\D/g, "");
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  // Fetch booking and verify phone ownership
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .eq("phone", cleanPhone)
    .single();

  if (fetchErr || !booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  // Block cancelling past appointments
  const now = new Date();
  const vegasNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const apptDateTime = new Date(`${booking.date}T${booking.start_time}`);
  const hoursUntil = (apptDateTime - vegasNow) / (1000 * 60 * 60);

  if (hoursUntil <= 0) {
    return res.status(400).json({ error: "Cannot cancel a past appointment" });
  }

  const refundEligible = hoursUntil > 48 && booking.paid && booking.session_id;
  let refundIssued = false;

  // Issue Stripe refund if eligible
  if (refundEligible) {
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(booking.session_id);
      if (stripeSession.payment_intent) {
        await stripe.refunds.create({
          payment_intent: stripeSession.payment_intent,
          reason: "requested_by_customer",
        });
        refundIssued = true;
        console.log(`✅ Refund issued for booking ${booking_id}`);
      }
    } catch (refundErr) {
      console.error("❌ Refund failed:", refundErr.message);
      return res.status(500).json({ error: "Failed to process refund. Please DM @myasnailsbaby for help." });
    }
  }

  // Delete the booking to free the slot
  const { error: deleteErr } = await supabase
    .from("bookings")
    .delete()
    .eq("id", booking_id);

  if (deleteErr) {
    console.error("❌ Delete failed:", deleteErr.message);
    return res.status(500).json({ error: "Failed to cancel booking. Please try again." });
  }

  // SMS to client
  try {
    const formattedPhone = `+1${cleanPhone}`;
    let refundNote = "";
    if (refundIssued) {
      refundNote = " Your $20 deposit refund has been initiated and should appear in 5-10 business days.";
    } else if (booking.paid) {
      refundNote = " Your $20 deposit is non-refundable for cancellations within 48 hours of the appointment.";
    }

    await twilioClient.messages.create({
      body: `Hey ${booking.name}! Your nail appointment with Mya on ${booking.date} @ ${to12h(booking.start_time)} has been cancelled.${refundNote} DM @myasnailsbaby with any questions.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });
  } catch (smsErr) {
    console.error("❌ Client SMS failed:", smsErr.message);
  }

  // Email to Mya
  try {
    await resend.emails.send({
      from: "Mya's Nails <bookings@myasnailsbaby.com>",
      to: ["myasnailsbaby@gmail.com"],
      subject: "Appointment Cancelled",
      html: `
        <h2>Appointment Cancelled by Client</h2>
        <p><strong>Name:</strong> ${booking.name}</p>
        <p><strong>Phone:</strong> ${booking.phone}</p>
        ${booking.email ? `<p><strong>Email:</strong> ${booking.email}</p>` : ""}
        <p><strong>Service:</strong> ${booking.service}</p>
        <p><strong>Date:</strong> ${booking.date}</p>
        <p><strong>Time:</strong> ${to12h(booking.start_time)}</p>
        <p><strong>Deposit Refunded:</strong> ${refundIssued ? "Yes — $20 returned to client" : booking.paid ? "No — cancelled within 48 hours" : "N/A — no deposit on file"}</p>
      `,
    });
  } catch (emailErr) {
    console.error("❌ Mya email failed:", emailErr.message);
  }

  // Cancellation confirmation email to client
  if (booking.email) {
    try {
      const refundRow = refundIssued
        ? `<tr><td style="padding:7px 0;color:#B3A48E;font-size:12px;border-bottom:1px solid #F4EEE3;">Refund</td><td style="padding:7px 0;color:#166534;font-weight:bold;font-size:13px;border-bottom:1px solid #F4EEE3;">$20 refund initiated (5–10 business days)</td></tr>`
        : booking.paid
        ? `<tr><td style="padding:7px 0;color:#B3A48E;font-size:12px;border-bottom:1px solid #F4EEE3;">Deposit</td><td style="padding:7px 0;color:#8F7440;font-weight:bold;font-size:13px;border-bottom:1px solid #F4EEE3;">Non-refundable (cancelled within 48 hrs)</td></tr>`
        : "";

      await resend.emails.send({
        from: "Mya's Nails <bookings@myasnailsbaby.com>",
        to: [booking.email],
        subject: "Your Appointment Has Been Cancelled",
        html: `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#FAF7F1;border:1px solid #E9E1D2;">
            <div style="background:#231D18;padding:32px;text-align:center;">
              <p style="color:#B08D57;margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;">MyasNailsBaby</p>
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:normal;letter-spacing:1px;">Appointment Cancelled</h1>
              <div style="width:48px;height:1px;background:linear-gradient(90deg,transparent,#B08D57,#F0E6CF,#B08D57,transparent);margin:16px auto 0;"></div>
            </div>
            <div style="padding:32px;background:#ffffff;">
              <p style="color:#4E453B;margin:0 0 6px;font-size:14px;">Hi ${booking.name},</p>
              <p style="color:#231D18;margin:0 0 28px;font-size:16px;font-weight:bold;">Your appointment has been cancelled.</p>
              <div style="border:1px solid #E9E1D2;padding:20px 24px;margin-bottom:24px;background:#FAF7F1;">
                <p style="margin:0 0 14px;font-size:10px;font-weight:bold;color:#B3A48E;text-transform:uppercase;letter-spacing:2px;">Cancelled Appointment</p>
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:7px 0;color:#B3A48E;font-size:12px;width:40%;border-bottom:1px solid #F4EEE3;">Date</td>
                    <td style="padding:7px 0;color:#231D18;font-weight:bold;font-size:13px;border-bottom:1px solid #F4EEE3;">${booking.date}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;color:#B3A48E;font-size:12px;border-bottom:1px solid #F4EEE3;">Time</td>
                    <td style="padding:7px 0;color:#231D18;font-weight:bold;font-size:13px;border-bottom:1px solid #F4EEE3;">${to12h(booking.start_time)}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;color:#B3A48E;font-size:12px;border-bottom:1px solid #F4EEE3;">Service</td>
                    <td style="padding:7px 0;color:#231D18;font-weight:bold;font-size:13px;border-bottom:1px solid #F4EEE3;">${booking.service}</td>
                  </tr>
                  ${refundRow}
                </table>
              </div>
              <p style="color:#8C7D68;font-size:12px;margin:0 0 28px;line-height:1.7;border-top:1px solid #E9E1D2;padding-top:20px;">
                We hope to see you again soon. Book a new appointment anytime at myasnailsbaby.com.
              </p>
              <div style="text-align:center;">
                <a href="https://instagram.com/myasnailsbaby"
                   style="display:inline-block;background:#8F7440;color:#fff;padding:14px 36px;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                  DM @myasnailsbaby
                </a>
              </div>
            </div>
            <div style="background:#231D18;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#8C7D68;font-size:11px;letter-spacing:1px;">MYASNAILSBABY &middot; LAS VEGAS, NV &middot; @MYASNAILSBABY</p>
            </div>
          </div>
        `,
      });
    } catch (clientEmailErr) {
      console.error("❌ Client email failed:", clientEmailErr.message);
    }
  }

  return res.status(200).json({ success: true, refund_issued: refundIssued });
}
