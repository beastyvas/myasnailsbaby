import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { isStopReply, normalizePhone, sendSms } from "@/utils/sms";

// SERVICE ROLE — this route writes the opt-out list and is called by
// Textbelt, which carries no Supabase session.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Constant-time compare that tolerates differing lengths. */
function secretMatches(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Inbound SMS replies from Textbelt (set as replyWebhookUrl on campaign
 * sends). Its job is narrow and important: when someone replies STOP, honor
 * it immediately rather than waiting for Mya to read the message.
 *
 * Marketing opt-out only — confirmations, reminders and cancellation notices
 * for appointments they booked still go out, as they should.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // Everything below can send a text on Mya's account, so the route fails
  // closed: no secret configured means no callers are trusted. Textbelt is
  // still answered with 200 so it doesn't retry forever.
  const expected = process.env.TEXTBELT_WEBHOOK_SECRET;
  if (!expected) {
    console.error(
      "TEXTBELT_WEBHOOK_SECRET is not set — refusing inbound SMS replies. " +
        "Set it in the environment, or STOP can't be honored automatically."
    );
    return res.status(200).json({ ok: true });
  }

  const body = req.body ?? null;
  if (!body) return res.status(200).json({ ok: true });

  // Textbelt echoes the secret back in webhookData as `data`.
  if (typeof body.data !== "string" || !secretMatches(body.data, expected)) {
    console.warn("Rejected SMS reply webhook: webhookData did not match");
    return res.status(200).json({ ok: true });
  }

  const phone = normalizePhone(body.fromNumber ?? "");
  const text = String(body.text ?? "");
  if (!phone || !text) return res.status(200).json({ ok: true });

  if (!isStopReply(text)) {
    // A real reply meant for a human. Forward it so nothing gets missed —
    // Textbelt replies don't land in Mya's own messages otherwise.
    if (process.env.MYA_PHONE_NUMBER) {
      await sendSms(
        process.env.MYA_PHONE_NUMBER,
        `Reply from ${phone}:\n"${text.slice(0, 200)}"`
      );
    }
    return res.status(200).json({ ok: true });
  }

  const { error } = await supabase
    .from("marketing_optouts")
    .upsert({ phone }, { onConflict: "phone" });

  if (error) {
    console.error("Failed to record opt-out:", error.message);
    return res.status(200).json({ ok: true });
  }

  // last 4 only — runtime logs are widely readable and this is client PII
  console.log(`Marketing opt-out honored for ***${phone.slice(-4)}`);

  // Confirm it, the way every compliant sender does — one final message so
  // they know it worked and don't wonder.
  await sendSms(
    phone,
    "Mya's Nails Baby: You're unsubscribed from offers and won't get them again. " +
      "Appointment confirmations and reminders will still come through 💅"
  );

  return res.status(200).json({ ok: true });
}
