import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";
import { sendSmsOnce } from "@/utils/smsOnce";
import { prettyDate, to12h } from "@/utils/time";

/** Forfeited when someone doesn't turn up, per the policy they agree to at
 *  booking. Matches the $25 quoted on the site and in the dashboard prompt. */
const NO_SHOW_FEE_CENTS = 2500;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // This route charges a saved card. It previously ran with no auth at all,
  // so anyone who could guess a booking id could bill a client $25.
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  const { booking_id } = req.body ?? {};
  if (!booking_id) return res.status(400).json({ error: "Missing booking_id" });

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, name, phone, email, date, start_time, stripe_customer_id, stripe_payment_method_id, no_show_charged")
    .eq("id", booking_id)
    .single();

  if (error || !booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.no_show_charged) return res.status(409).json({ error: "No-show fee already charged" });
  if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
    return res.status(422).json({ error: "No card on file for this booking" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: NO_SHOW_FEE_CENTS,
      currency: "usd",
      customer: booking.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `No-show fee — ${booking.name} — appt ${booking.date}`,
    });

    await supabase
      .from("bookings")
      .update({
        no_show_charged: true,
        no_show_fee_amount: NO_SHOW_FEE_CENTS,
        no_show: true,
      })
      .eq("id", booking_id);

    // Tell them. A surprise charge on a saved card with no explanation is
    // how a no-show fee turns into a chargeback and a bad review — and the
    // policy they agreed to at booking says the fee applies, so there's
    // nothing here she should be shy about stating plainly.
    await sendSmsOnce(
      supabase,
      booking.id,
      "no_show_fee",
      booking.phone,
      `Hi ${firstName(booking.name)}, this is Mya's Nails Baby. We missed you at your ` +
        `${prettyDate(booking.date)} appointment at ${to12h(booking.start_time)}, so the ` +
        `$${NO_SHOW_FEE_CENTS / 100} no-show fee you agreed to at booking has been charged to your card.\n` +
        `If something came up, please DM @myasnailsbaby — I'd rather sort it out than lose you.`
    );

    return res.status(200).json({ success: true, payment_intent_id: paymentIntent.id });
  } catch (err) {
    console.error("No-show charge failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

function firstName(full) {
  return String(full ?? "").trim().split(/\s+/)[0] || "there";
}
