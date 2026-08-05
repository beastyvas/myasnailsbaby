// File: /pages/api/create-checkout-session.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { quote } from "@/utils/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// SERVICE ROLE: pending_checkouts runs RLS-on with no policy, so nothing in
// the browser can read the list of people who nearly booked.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** "8AM" / "8:00AM" / "08:00" → "08:00:00" for a Postgres TIME column. */
function to24h(label) {
  if (!label) return null;
  const raw = String(label).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    const [h, m] = raw.split(":");
    return `${h.padStart(2, "0")}:${m}:00`;
  }
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const mins = m[2] ?? "00";
  if (m[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (m[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${mins}:00`;
}

async function findOrCreateCustomer({ email, name, phone }) {
  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;
  }
  const customer = await stripe.customers.create({
    name,
    ...(email ? { email } : {}),
    metadata: { phone: phone || "" },
  });
  return customer.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { bookingMetadata } = req.body;

    console.log("📦 Creating Stripe Checkout with metadata:", bookingMetadata);

    if (
      !bookingMetadata?.booking_id ||
      typeof bookingMetadata.booking_id !== "string" ||
      bookingMetadata.booking_id.length < 10
    ) {
      console.error("❌ Invalid or missing booking_id in metadata");
      return res.status(400).json({ error: "Missing or invalid booking_id" });
    }

    let customerId;
    try {
      customerId = await findOrCreateCustomer({
        email: bookingMetadata.email,
        name: bookingMetadata.name,
        phone: bookingMetadata.phone,
      });
    } catch (e) {
      console.error("⚠️ Could not find/create Stripe customer:", e.message);
    }

    // Price it here, from the selections, rather than trusting a number the
    // browser sends. The deposit is a fixed $20 so a tampered form can't
    // steal money — but this figure is what Mya reads at the chair and what
    // the books are built on, so it has to be the server's own arithmetic.
    const priced = quote({
      bookingNails: bookingMetadata.booking_nails,
      service: bookingMetadata.service,
      length: bookingMetadata.length,
      artLevel: bookingMetadata.artLevel,
      soakoff: bookingMetadata.soakoff,
      pedicure: bookingMetadata.pedicure,
      pedicureType: bookingMetadata.pedicure_type,
      spaPedi: bookingMetadata.spa_pedi === "yes",
    });
    const quotedCents = priced.unknown ? null : priced.total;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      ...(customerId ? { customer: customerId } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Nail Deposit",
              description:
                "$20 deposit to confirm your appointment. Refundable if cancelled 48+ hours in advance. By completing this payment you authorize a $25 no-show fee to be charged to this card if you miss your appointment without notice.",
            },
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      mode: "payment",
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: {
  booking_id: bookingMetadata.booking_id,
  name: bookingMetadata.name,
  instagram: bookingMetadata.instagram,
  phone: bookingMetadata.phone,
  service: bookingMetadata.service,
  artLevel: bookingMetadata.artLevel,
  length: bookingMetadata.length,
  date: bookingMetadata.date,
  start_time: bookingMetadata.start_time,
  notes: bookingMetadata.notes,
  soakoff: bookingMetadata.soakoff,
  returning: bookingMetadata.returning,
  pedicure_type: bookingMetadata.pedicure_type,
  duration: bookingMetadata.duration,
  booking_nails: bookingMetadata.booking_nails,
  referral: bookingMetadata.referral,
  pedicure: bookingMetadata.pedicure,
  email: bookingMetadata.email ?? null,
  spa_pedi: bookingMetadata.spa_pedi ?? "no",
  quoted_cents: quotedCents == null ? "" : String(quotedCents),
},

    });

    // Remember that they got this far. Bookings are only written on payment,
    // so without this row someone who reaches the card form and stops is
    // invisible — despite being the most recoverable person in the funnel.
    // Never blocks checkout: a failed insert costs a recovery text, whereas
    // a thrown error would cost the booking itself.
    if (bookingMetadata.phone) {
      const { error: pendingErr } = await supabase.from("pending_checkouts").insert({
        stripe_session_id: session.id,
        name: bookingMetadata.name ?? "",
        phone: bookingMetadata.phone,
        service: bookingMetadata.service ?? null,
        date: bookingMetadata.date ?? null,
        start_time: to24h(bookingMetadata.start_time),
      });
      if (pendingErr) console.error("⚠️ Could not log pending checkout:", pendingErr.message);
    }

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe session error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}