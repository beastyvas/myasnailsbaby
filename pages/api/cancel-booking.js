// No Stripe import: this route no longer refunds anything. The deposit is
// non-refundable and becomes a credit instead, so nothing here touches a
// payment. Leaving the client wired up would imply otherwise.
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { normalizePhone, sendSms } from "@/utils/sms";
import { DEPOSIT_CENTS } from "@/utils/pricing";
import { CLIENT_CANCEL_ENABLED } from "@/utils/features";
import * as M from "@/utils/messages";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

function to12h(time24) {
  if (!time24) return "";
  const [hourStr, minuteStr = "00"] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr}${suffix}`;
}

export default async function handler(req, res) {
  // Checked first, before the method check even matters: while cancelling is
  // off this route does not exist as far as any caller is concerned.
  // Removing the footer link is cosmetic — an old bookmark or a browser
  // autocomplete would still reach here, delete a real booking and write a
  // credit Mya hasn't agreed to.
  if (!CLIENT_CANCEL_ENABLED) {
    return res.status(403).json({
      error: "Cancelling online is turned off. Please text Mya to cancel.",
    });
  }

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

  // NO REFUND. The deposit is non-refundable — the booking page and the terms
  // have always said so, and this route used to refund it anyway whenever the
  // cancellation was more than 48 hours out. A client cancelled and got their
  // $20 back off the back of that contradiction.
  //
  // Non-refundable is not the same as forfeited, though. Mya keeps the money
  // and honours it against their next visit, so instead of a Stripe refund
  // the deposit becomes a credit against their phone number.
  let creditIssued = false;
  if (booking.paid) {
    const creditPhone = normalizePhone(cleanPhone);
    // Name and date are copied onto the credit rather than joined back:
    // cancelling deletes the booking a few lines below, so a foreign key
    // would be null before anyone could read it. Mya still needs to be able
    // to answer "where did this $20 come from".
    const { error: creditErr } = await supabase.from("client_credits").insert({
      phone: creditPhone,
      amount_cents: DEPOSIT_CENTS,
      reason: "cancelled_deposit",
      booking_id,
      client_name: booking.name || "",
      source_date: booking.date,
    });

    if (creditErr) {
      // Deliberately not fatal. Freeing the slot matters more than the
      // bookkeeping, and failing here would leave the appointment on the
      // calendar for a client who believes they cancelled.
      console.error(
        `⚠️ Couldn't record the $20 credit for ${creditPhone} (${creditErr.message}) — ` +
          "has supabase/migrations/add_client_credits.sql been run?"
      );
    } else {
      creditIssued = true;
      console.log(`💳 $20 credit recorded for ${creditPhone}`);
    }
  }

  // If the booking being cancelled had itself consumed a credit, hand it
  // back. Otherwise cancelling twice would quietly eat the client's money.
  if (booking.credit_applied_cents > 0) {
    const { error: releaseErr } = await supabase.rpc("release_client_credit", {
      p_phone: normalizePhone(cleanPhone),
      p_cents: booking.credit_applied_cents,
    });
    if (releaseErr) {
      console.error(`⚠️ Couldn't release ${booking.credit_applied_cents}c of credit:`, releaseErr.message);
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
  {
    // The deposit isn't coming back to their card, but they haven't lost it
    // — say both halves, or "non-refundable" reads as "gone".
    const refundNote = booking.paid
      ? " Your $20 deposit isn't refunded, but it stays on your account and comes off your next appointment."
      : "";

    await sendSms(
      cleanPhone,
      M.cancelledByClient({
        name: booking.name,
        date: booking.date,
        startTime: booking.start_time,
        refundNote,
      })
    );

    // Mya gets an email below, but a freed-up slot is time-sensitive — she
    // can only fill it if she finds out while it's still worth filling.
    if (process.env.MYA_PHONE_NUMBER) {
      await sendSms(
        process.env.MYA_PHONE_NUMBER,
        M.ownerCancelled({
          name: booking.name,
          date: booking.date,
          startTime: booking.start_time,
          creditIssued,
        })
      );
    }
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
        <p><strong>Deposit:</strong> ${creditIssued ? "Kept — $20 credited to them for next time" : booking.paid ? "Kept — credit NOT recorded, check the logs" : "N/A — no deposit on file"}</p>
      `,
    });
  } catch (emailErr) {
    console.error("❌ Mya email failed:", emailErr.message);
  }

  // Cancellation confirmation email to client
  if (booking.email) {
    try {
      const refundRow = booking.paid
        ? `<tr><td style="padding:7px 0;color:#a8a29e;font-size:12px;border-bottom:1px solid #f5f5f4;">Deposit</td><td style="padding:7px 0;color:#9f1239;font-weight:bold;font-size:13px;border-bottom:1px solid #f5f5f4;">Not refunded — $20 credit toward your next appointment</td></tr>`
        : "";

      await resend.emails.send({
        from: "Mya's Nails <bookings@myasnailsbaby.com>",
        to: [booking.email],
        subject: "Your Appointment Has Been Cancelled",
        html: `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#fafaf9;border:1px solid #e7e5e4;">
            <div style="background:#1c1917;padding:32px;text-align:center;">
              <p style="color:#c9848c;margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;">MyasNailsBaby</p>
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:normal;letter-spacing:1px;">Appointment Cancelled</h1>
              <div style="width:48px;height:1px;background:linear-gradient(90deg,transparent,#c9848c,#e8b4b8,#c9848c,transparent);margin:16px auto 0;"></div>
            </div>
            <div style="padding:32px;background:#ffffff;">
              <p style="color:#57534e;margin:0 0 6px;font-size:14px;">Hi ${booking.name},</p>
              <p style="color:#1c1917;margin:0 0 28px;font-size:16px;font-weight:bold;">Your appointment has been cancelled.</p>
              <div style="border:1px solid #e7e5e4;padding:20px 24px;margin-bottom:24px;background:#fafaf9;">
                <p style="margin:0 0 14px;font-size:10px;font-weight:bold;color:#a8a29e;text-transform:uppercase;letter-spacing:2px;">Cancelled Appointment</p>
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:7px 0;color:#a8a29e;font-size:12px;width:40%;border-bottom:1px solid #f5f5f4;">Date</td>
                    <td style="padding:7px 0;color:#1c1917;font-weight:bold;font-size:13px;border-bottom:1px solid #f5f5f4;">${booking.date}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;color:#a8a29e;font-size:12px;border-bottom:1px solid #f5f5f4;">Time</td>
                    <td style="padding:7px 0;color:#1c1917;font-weight:bold;font-size:13px;border-bottom:1px solid #f5f5f4;">${to12h(booking.start_time)}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;color:#a8a29e;font-size:12px;border-bottom:1px solid #f5f5f4;">Service</td>
                    <td style="padding:7px 0;color:#1c1917;font-weight:bold;font-size:13px;border-bottom:1px solid #f5f5f4;">${booking.service}</td>
                  </tr>
                  ${refundRow}
                </table>
              </div>
              <p style="color:#78716c;font-size:12px;margin:0 0 28px;line-height:1.7;border-top:1px solid #e7e5e4;padding-top:20px;">
                We hope to see you again soon. Book a new appointment anytime at myasnailsbaby.com.
              </p>
              <div style="text-align:center;">
                <a href="https://instagram.com/myasnailsbaby"
                   style="display:inline-block;background:#9f1239;color:#fff;padding:14px 36px;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                  DM @myasnailsbaby
                </a>
              </div>
            </div>
            <div style="background:#1c1917;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#78716c;font-size:11px;letter-spacing:1px;">MYASNAILSBABY &middot; LAS VEGAS, NV &middot; @MYASNAILSBABY</p>
            </div>
          </div>
        `,
      });
    } catch (clientEmailErr) {
      console.error("❌ Client email failed:", clientEmailErr.message);
    }
  }

  return res.status(200).json({ success: true, credit_issued: creditIssued });
}
