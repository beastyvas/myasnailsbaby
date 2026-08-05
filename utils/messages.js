/** Every text this site sends, in one place.
 *
 *  These were previously inline in nine route files, and the booking
 *  confirmation existed as two separate copies that had to be kept in sync by
 *  hand. Wording is the part Mya actually cares about and the part most likely
 *  to change, so it belongs somewhere she can be shown all of it at once and
 *  where a change lands everywhere it should.
 *
 *  Rules that apply to all of them:
 *   · No links. Textbelt refuses messages containing URLs until the sending
 *     domain is whitelisted, so the call to action is always a code, a search
 *     term, or a DM — all of which work from a lock screen.
 *   · Promotional messages carry an opt-out line. Transactional ones don't
 *     need it and shouldn't waste characters on it.
 *   · Keep them under ~480 characters. Textbelt bills per 160-character
 *     segment, so a stray sentence costs real money on every send.
 */

import { prettyDate, to12h } from "./time.js";

export const STUDIO_ADDRESS = "2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV";
export const BRAND = "Mya's Nails Baby";
export const IG = "@myasnailsbaby";

export function firstName(full) {
  return String(full ?? "").trim().split(/\s+/)[0] || "love";
}

/* ─────────────────────────── to the client ─────────────────────────── */

/** Sent the moment Stripe reports payment. */
export function bookingConfirmation({ name, date, startTime }) {
  return (
    `Hey love! Your appointment with Mya is confirmed for ${prettyDate(date)} ` +
    `at ${to12h(startTime)} 💅\n` +
    `📍 ${STUDIO_ADDRESS}\n` +
    `DM ${IG} if you need anything!\n` +
    `Reply STOP to unsubscribe.`
  );
}

/** 23–25 hours out. Carries the policies so nobody is surprised at the chair. */
export function reminder24h({ name, date, startTime }) {
  return (
    `Hi ${firstName(name)}! Reminder from ${BRAND} — your appointment is tomorrow, ` +
    `${prettyDate(date)} at ${to12h(startTime)}.\n` +
    `📍 ${STUDIO_ADDRESS}\n` +
    `Please arrive on time. Deposits are non-refundable and no extra guests please.\n` +
    `DM ${IG} if anything changes!`
  );
}

/** 2–4 hours out. Short on purpose — they already know the details. */
export function reminderDayOf({ name, startTime }) {
  return (
    `See you today at ${to12h(startTime)}, ${firstName(name)}! 💅\n` +
    `📍 ${STUDIO_ADDRESS}\n` +
    `— ${BRAND}`
  );
}

/** 2–4 hours after the appointment ends, while they still love their nails.
 *  Names the exact search string because there's no link to tap. */
export function reviewRequest({ name }) {
  return (
    `Thank you for coming in today, ${firstName(name)}! 🤍 I loved doing your nails.\n` +
    `If you have 30 seconds, a Google review helps me more than you know — just search ` +
    `"${BRAND} Las Vegas" on Google and tap Reviews.\n` +
    `See you next time! — Mya`
  );
}

/** At the fill interval. Promotional, so it carries the opt-out. */
export function rebookNudge({ name, weeks }) {
  return (
    `Hi ${firstName(name)}! It's Mya 💅 You're right about due for a fill — ` +
    `${weeks} weeks is usually when they start growing out.\n` +
    `Want me to save you a spot? Just DM ${IG} or book on the site and I'll get you in.\n` +
    `(Reply STOP if you'd rather not get these.)`
  );
}

/** 30 minutes after an unpaid checkout. Promotional. */
export function checkoutRecovery({ name, date, startTime }) {
  const when = date
    ? `${prettyDate(date)}${startTime ? ` at ${to12h(startTime)}` : ""}`
    : "your spot";
  return (
    `Hi ${firstName(name)}! It's Mya 💅 You picked ${when} but didn't quite finish ` +
    `checking out — that time is still open right now.\n` +
    `Finish up on the site whenever you're ready, or just DM ${IG} and I'll hold it for you.\n` +
    `(Reply STOP if you'd rather not get these.)`
  );
}

/** Two people paid for the same slot and this one lost. The most important
 *  message here: without it they believe they have an appointment. */
export function conflictRefund({ name, date, startTime }) {
  return (
    `Hi ${firstName(name)}, it's Mya — I'm so sorry. Someone booked ` +
    `${prettyDate(date)} at ${to12h(startTime)} moments before you did, and the ` +
    `payment went through before the system caught it.\n` +
    `Your $20 deposit has been refunded and should be back on your card in 5-10 ` +
    `business days. Nothing is booked for you.\n` +
    `Please grab another time on the site, or DM ${IG} and I'll sort you out personally.`
  );
}

/** A saved card was charged. States the policy they agreed to, without
 *  apology and without accusation, and leaves a door open. */
export function noShowFee({ name, date, startTime, feeCents }) {
  return (
    `Hi ${firstName(name)}, this is ${BRAND}. We missed you at your ` +
    `${prettyDate(date)} appointment at ${to12h(startTime)}, so the ` +
    `$${feeCents / 100} no-show fee you agreed to at booking has been charged to your card.\n` +
    `If something came up, please DM ${IG} — I'd rather sort it out than lose you.`
  );
}

/** The client cancelled on themselves. refundNote explains the deposit. */
export function cancelledByClient({ name, date, startTime, refundNote = "" }) {
  return (
    `Hey ${firstName(name)}! Your nail appointment with Mya on ${prettyDate(date)} @ ` +
    `${to12h(startTime)} has been cancelled.${refundNote} DM ${IG} with any questions.`
  );
}

/** Mya cancelled from the dashboard. They must hear this or they turn up. */
export function cancelledByMya({ name, date, startTime }) {
  return (
    `Hey ${firstName(name)}! Your nail appointment with Mya on ${prettyDate(date)} @ ` +
    `${startTime} was cancelled. Please DM ${IG} if you believe this was an error!`
  );
}

/** The client moved it themselves. */
export function rescheduledByClient({ name, oldDate, oldTime, newDate, newTime }) {
  return (
    `Hi ${firstName(name)}! Your appointment with Mya has been rescheduled:\n\n` +
    `Old: ${prettyDate(oldDate)} at ${to12h(oldTime)}\n` +
    `New: ${prettyDate(newDate)} at ${to12h(newTime)}\n\n` +
    `📍 ${STUDIO_ADDRESS}\n\n` +
    `DM ${IG} with questions! 💖\n\n` +
    `Reply STOP to unsubscribe.`
  );
}

/** Mya moved it from the dashboard. Only names what actually changed. */
export function movedByMya({ name, oldDate, oldTime, newDate, newTime }) {
  let msg = `Hi ${firstName(name)}! Your appointment with Mya has been updated:\n\n`;
  if (oldDate !== newDate) msg += `📅 New Date: ${prettyDate(newDate)}\n`;
  if (oldTime !== newTime) msg += `🕐 New Time: ${to12h(newTime)}\n`;
  msg += `\n📍 ${STUDIO_ADDRESS}\n\nDM ${IG} if you have any questions! 💖`;
  return msg;
}

/** Confirms an opt-out, and makes clear what still comes through. */
export function optOutConfirmed() {
  return (
    `${BRAND}: You're unsubscribed from offers and won't get them again. ` +
    `Appointment confirmations and reminders will still come through 💅`
  );
}

/* ──────────────────────────── to Mya ───────────────────────────────── */

export function ownerNewBooking({ name, service, pedicure, date, startTime, quotedCents }) {
  // The estimate is what she's owed at the chair less the deposit already
  // taken, so she can see what the appointment is worth as it lands.
  const money =
    quotedCents != null && quotedCents > 0
      ? `\n~$${Math.round(quotedCents / 100)} · $${Math.round((quotedCents - 2000) / 100)} due at the visit`
      : "";
  return (
    `📅 New booking — ${name || "someone"}\n` +
    `${service || "Nails"}${pedicure === "yes" ? " + pedicure" : ""}\n` +
    `${prettyDate(date)} at ${to12h(startTime)}` + money
  );
}

export function ownerCancelled({ name, date, startTime, refundIssued }) {
  return (
    `❌ Cancelled — ${name}\n` +
    `${prettyDate(date)} at ${to12h(startTime)}\n` +
    (refundIssued ? "Deposit refunded (48h+ notice)." : "Deposit kept.") +
    "\nThat slot is open again."
  );
}

export function ownerRescheduled({ name, oldDate, oldTime, newDate, newTime }) {
  return (
    `🔄 Moved — ${name}\n` +
    `Was: ${prettyDate(oldDate)} at ${to12h(oldTime)}\n` +
    `Now: ${prettyDate(newDate)} at ${to12h(newTime)}`
  );
}

export function ownerForwardedReply({ phone, text }) {
  return `Reply from ${phone}:\n"${String(text).slice(0, 200)}"`;
}
