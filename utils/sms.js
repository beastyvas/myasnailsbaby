/** Textbelt SMS — the one place a text leaves this site.
 *
 *  Replaces Twilio. Textbelt is pay-per-text with no monthly line rental,
 *  which is the right shape for a single-chair shop: one key, no carrier
 *  registration, no per-number bill for months with light booking.
 */

const TEXTBELT_ENDPOINT = "https://textbelt.com/text";
const TEXTBELT_QUOTA_ENDPOINT = "https://textbelt.com/quota";

/** Links are off.
 *
 *  Textbelt refuses messages containing URLs until the sending domain is
 *  whitelisted, and that approval isn't ours to grant. Rather than discover
 *  it one failed send at a time, every outbound message is stripped of links
 *  before it goes out. Flip this to true once myasnailsbaby.com is approved
 *  and links start flowing again — nothing else needs to change. */
const ALLOW_LINKS = false;

/** Everything from "http" to the next space. Only ever used with .replace(),
 *  never .test() — a /g regex keeps state between .test() calls. */
const URL_PATTERN = /https?:\/\/\S+/g;

const SITE_HOST = "myasnailsbaby.com";

/**
 * The Textbelt API key.
 *
 * Accepts either name. The variable in Vercel was TEXTBELT_API_KEY while this
 * code only ever read TEXTBELT_KEY, so every send took the "no key configured"
 * path — which used to return success without sending. Four days of texts that
 * the dashboard counted and no client received, over one word.
 *
 * Both names are read rather than picking a winner and renaming, because the
 * failure was never that one name is correct: it was that a missing key was
 * indistinguishable from a working one. TEXTBELT_API_KEY is a perfectly
 * reasonable thing to call it, and code that only works if you guess the
 * author's convention is the brittle part.
 *
 * Trimmed because a trailing newline from a paste is the same silent failure
 * wearing a different hat.
 */
export function textbeltKey() {
  return (process.env.TEXTBELT_KEY || process.env.TEXTBELT_API_KEY || "").trim();
}

export function textbeltConfigured() {
  return !!textbeltKey();
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/** The same message with every link replaced by the bare domain.
 *
 *  A client who hears nothing is far worse than a client who's told where to
 *  go, so a message that would be refused is rewritten rather than dropped. */
export function stripLinks(message, siteName = SITE_HOST) {
  if (!/https?:\/\//.test(message)) return message;
  return message
    .replace(URL_PATTERN, siteName)
    // collapse the blank lines a removed link can leave behind
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Textbelt's wording varies; anything mentioning links or URLs means the
 *  message was refused for containing one. */
function isLinkRejection(error) {
  return /link|url|domain|whitelist/i.test(error ?? "");
}

/**
 * Send one text.
 *
 * @param {string} phone   any human format — normalized here
 * @param {string} message body; links are removed while ALLOW_LINKS is false
 * @param {{ listenForReplies?: boolean }} opts
 *        listenForReplies asks Textbelt to POST replies to /api/sms-reply so
 *        STOP is honored without Mya having to read the message. Required on
 *        promotional texts, harmless on transactional ones.
 * @returns {Promise<boolean>} true when Textbelt accepted the message
 */
export async function sendSms(phone, message, opts = {}) {
  const to = normalizePhone(phone);
  if (!to) {
    console.error("SMS skipped — unusable phone number");
    return false;
  }

  const body = ALLOW_LINKS ? message : stripLinks(message);

  // No key configured.
  //
  // In development that's normal and the message is logged instead — working
  // on the booking flow shouldn't require a funded Textbelt key.
  //
  // In production it is a serious fault, and returning `true` here was a bug
  // that hid for a day: the automations reported four texts sent, wrote four
  // sms_log rows, and showed Mya a confident "4 sent" on her dashboard while
  // nothing left the building. It surfaced only because the credit balance
  // hadn't moved. A function that says a text was delivered when it wasn't
  // defeats every guard built on top of it — sms_log then blocks the retry
  // forever, so the client is never reminded at all.
  //
  // Returning false instead feeds the existing machinery: sendOnce releases
  // the sms_log claim so the next run retries, `failures` is populated, and
  // the workflow fails and emails.
  if (!textbeltConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `No Textbelt key — refusing to report a send to ${to} that did not happen. ` +
          "Set TEXTBELT_KEY or TEXTBELT_API_KEY in Vercel (Production scope) and redeploy."
      );
      return false;
    }
    console.log(`[sms demo] to ${to}:\n${body}\n`);
    return true;
  }

  const sent = await post(to, body, opts);
  if (sent.ok) return true;

  // Belt and braces: if a link slips through some future edit and Textbelt
  // refuses it, resend without rather than leave the client uninformed.
  if (isLinkRejection(sent.error) && /https?:\/\//.test(body)) {
    console.warn(`Textbelt refused a link for ${to} — resending without it.`);
    const retry = await post(to, stripLinks(body), opts);
    return retry.ok;
  }

  return false;
}

async function post(to, message, opts) {
  const payload = {
    phone: to,
    message,
    key: textbeltKey(),
  };

  if (opts.listenForReplies) {
    // Textbelt posts inbound replies here; /api/sms-reply turns STOP into a
    // marketing opt-out. Only works on a public URL, so it's skipped on
    // localhost — replies would have nowhere to land.
    const base = siteUrl();
    if (!base.includes("localhost")) {
      payload.replyWebhookUrl = `${base}/api/sms-reply`;
      if (process.env.TEXTBELT_WEBHOOK_SECRET) {
        payload.webhookData = process.env.TEXTBELT_WEBHOOK_SECRET;
      }
    }
  }

  try {
    const res = await fetch(TEXTBELT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) console.error(`Textbelt error for ${to}: ${json.error}`);
    return { ok: !!json.success, error: json.error, quotaRemaining: json.quotaRemaining };
  } catch (err) {
    console.error("Textbelt request failed:", err);
    return { ok: false };
  }
}

/**
 * Textbelt credits remaining, or null if we can't tell.
 *
 * Every send already returns `quotaRemaining` and every send already threw it
 * away — but most runs send nothing, and a run that sends nothing is exactly
 * when you'd want advance warning. So this asks directly, once per run.
 *
 * Running out of credits is the most likely real failure and it fails
 * silently: sendSms returns false, the engine records it in `failures`, and
 * the run still answers HTTP 200. Knowing the balance beforehand is what turns
 * that into a warning instead of a surprise.
 *
 * Null means unknown, never zero. An unconfigured key and an empty balance are
 * different things and must not produce the same alarm.
 */
export async function checkQuota() {
  if (!textbeltConfigured()) return null;
  try {
    const res = await fetch(`${TEXTBELT_QUOTA_ENDPOINT}/${textbeltKey()}`);
    const json = await res.json();
    return typeof json.quotaRemaining === "number" ? json.quotaRemaining : null;
  } catch (err) {
    // Never throw: a bookkeeping call must not be able to stop texts going out.
    console.error("Textbelt quota check failed:", err?.message || err);
    return null;
  }
}

/** Words a person actually sends when they want the texts to stop. */
const STOP_WORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "stopped",
  "remove",
  "optout",
  "opt-out",
]);

/** True when an inbound reply is an opt-out request. Tolerant of case,
 *  punctuation and a trailing "please" — people rarely text exactly "STOP". */
export function isStopReply(text) {
  const cleaned = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .trim();
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/).filter((w) => w !== "please" && w !== "me");
  // a bare opt-out word, or a short phrase built around one ("stop texting me")
  return words.length > 0 && words.length <= 4 && words.some((w) => STOP_WORDS.has(w));
}

/** Accepts "(702) 555-0134", "702-555-0134", "+17025550134" → "+17025550134". */
export function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
