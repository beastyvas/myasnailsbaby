import { sendSms } from "./sms.js";

/**
 * Send a text at most once for a given (booking, kind).
 *
 * Several paths can legitimately fire the same message — Stripe retries its
 * webhook, the success page and the webhook both know a booking was paid
 * for, and the hourly job re-examines the same rows every run. The unique
 * constraint on sms_log is what makes that safe: the row is claimed *before*
 * the send, so two racing callers can't both get through.
 *
 * If the send then fails the claim is released, so the next attempt tries
 * again rather than the message being silently lost.
 *
 * @returns {Promise<"sent"|"skipped"|"failed">}
 */
export async function sendSmsOnce(supabase, bookingId, kind, phone, message, opts = {}) {
  if (!bookingId || !phone) return "skipped";

  const { error: claimErr } = await supabase
    .from("sms_log")
    .insert({ booking_id: bookingId, kind });

  if (claimErr) {
    // 23505 = unique violation: someone already sent this one. Anything else
    // means the log is broken — say so rather than quietly double-texting.
    if (claimErr.code !== "23505") {
      console.error(`sms_log claim failed (${kind}):`, claimErr.message);
    }
    return "skipped";
  }

  if (await sendSms(phone, message, opts)) return "sent";

  await supabase.from("sms_log").delete().eq("booking_id", bookingId).eq("kind", kind);
  return "failed";
}
