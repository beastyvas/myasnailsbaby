// File: /pages/api/stripe-webhook.js
import { buffer } from "micro";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone, sendSms } from "@/utils/sms";
import { sendSmsOnce } from "@/utils/smsOnce";
import * as M from "@/utils/messages";
import { firstNameOf, ownerAlert } from "@/utils/reactivation";
import { prettyDate } from "@/utils/time";

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
function to12h(time24) {
  if (!time24) return "unknown time";
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr}${suffix}`;
}

function addHoursTo24h(start24, hours) {
  const [h, m] = start24.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m || 0, 0)); // dummy date
  d.setUTCHours(d.getUTCHours() + (Number(hours) || 2));
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * If this booking came from a number Mya texted a reactivation offer to, and
 * the offer is still inside its window, credit it.
 *
 * Attribution is by phone number rather than by the code, on purpose: almost
 * nobody types a code back. Someone who gets the text and books a week later
 * came back because of it, whether or not they mention it — and Mya still
 * needs to know to honor the discount when they sit down.
 *
 * Never throws. A booking that's already paid for must not be undone because
 * the campaign bookkeeping had a bad day.
 */
async function creditReactivation(bookingId, booking) {
  try {
    const phone = normalizePhone(booking.phone);
    if (!phone) return;

    const { data: offer, error } = await supabase
      .from("reactivation_sends")
      .select("id, code, percent_off")
      .eq("phone", phone)
      .is("booking_id", null)
      .gt("expires_at", new Date().toISOString())
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("⚠️ Reactivation lookup failed:", error.message);
      return;
    }
    if (!offer) return;

    // Stamp the booking so the discount shows up wherever the booking does.
    await supabase
      .from("bookings")
      .update({ reactivation_code: offer.code, discount_percent: offer.percent_off })
      .eq("id", bookingId);

    // Close the offer so it can't be credited to a second booking.
    await supabase
      .from("reactivation_sends")
      .update({ booking_id: bookingId, booked_at: new Date().toISOString() })
      .eq("id", offer.id);

    console.log(`🎉 Reactivation credited: ${offer.code} → booking ${bookingId}`);

    if (process.env.MYA_PHONE_NUMBER) {
      await sendSms(
        process.env.MYA_PHONE_NUMBER,
        ownerAlert({
          clientName: booking.name || "A client",
          service: booking.service,
          date: booking.date,
          startTime: to12h(booking.start_time),
          percentOff: offer.percent_off,
          code: offer.code,
        })
      );
    }
  } catch (err) {
    console.error("⚠️ Reactivation credit failed:", err.message);
  }
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
  console.warn("⚠️ Time conflict; issuing refund. Conflicts:", conflicts);

  // Auto-refund the customer since we can't honor this booking
  try {
    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent,
      reason: "duplicate", // closest Stripe reason
    });
    console.log("✅ Refund issued:", refund.id, "for session:", session.id);
  } catch (refundErr) {
    console.error("❌ Failed to issue refund for session:", session.id, refundErr.message);
    // Even if refund fails, we still ack so Stripe stops retrying the webhook
  }

  // Mark booking as refunded in DB so confirm-payment shows a clear error
  const { data: refundedRow, error: refundLogErr } = await supabase
    .from("bookings")
    .insert([{
      session_id: session.id,
      name: md.name ?? null,
      phone: md.phone ?? null,
      date: safeDate,
      start_time: start24,
      end_time: end24,
      paid: false,
      confirmed: false,
      refunded: true,
      notes: "AUTO-REFUNDED: Time conflict at booking time",
    }])
    .select("id")
    .single();
  if (refundLogErr) console.error("⚠️ Could not log refunded booking:", refundLogErr.message);

  // Tell them. This is the worst thing that can happen silently: they paid,
  // the money went back, and unless they happened to still be sitting on the
  // success page they have no idea — so they turn up to an appointment that
  // was never made. sendSmsOnce keeps Stripe's webhook retries from sending
  // the apology twice.
  if (refundedRow) {
    await sendSmsOnce(
      supabase,
      refundedRow.id,
      "conflict_refund",
      md.phone,
      M.conflictRefund({ name: md.name, date: safeDate, startTime: start24 })
    );
  }

  return res.status(200).json({ received: true });
}


    // Retrieve saved payment method from the completed payment intent
    let stripeCustomerId = session.customer || null;
    let stripePaymentMethodId = null;
    if (session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
        stripePaymentMethodId = pi.payment_method || null;
      } catch (e) {
        console.error("⚠️ Could not retrieve payment intent:", e.message);
      }
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
      email: md.email ?? null,
      booking_nails: md.booking_nails ?? null,
      paid: true,
      confirmed: true,
      session_id: session.id,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_method_id: stripePaymentMethodId,
    };

    const { data: created, error: insertErr } = await supabase
      .from("bookings")
      .insert([insert])
      .select("id")
      .single();
    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr.message);
      return res.status(200).json({ received: true }); // ack so Stripe stops retrying
    }

    // The client's confirmation is sent from here, not from the success page.
    // /api/confirm-payment only runs if the browser actually lands on
    // /success — a client who pays and closes the tab used to be booked and
    // never told. Stripe retries this webhook until it succeeds, and the
    // sms_log claim keeps the success page from sending a second copy.
    await sendSmsOnce(
      supabase,
      created.id,
      "booking_confirmation",
      insert.phone,
      M.bookingConfirmation({ name: insert.name, date: insert.date, startTime: insert.start_time })
    );

    // Mya has always been emailed about a new booking, but never texted —
    // an email is easy to miss mid-set. Failures are swallowed: the client
    // has already paid and been confirmed.
    if (process.env.MYA_PHONE_NUMBER) {
      await sendSms(
        process.env.MYA_PHONE_NUMBER,
        M.ownerNewBooking({
          name: insert.name,
          service: insert.service,
          pedicure: insert.pedicure,
          date: insert.date,
          startTime: insert.start_time,
        })
      );
    }

    // They paid — close the pending row so the recovery job never chases
    // someone who is already booked.
    await supabase
      .from("pending_checkouts")
      .update({ completed: true })
      .eq("stripe_session_id", session.id);

    await creditReactivation(created.id, insert);

    return res.status(200).json({ received: true });
  }

  // Always acknowledge unknown events to prevent retries storm
  return res.status(200).json({ received: true });
}