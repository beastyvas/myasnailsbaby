// File: /pages/api/confirm-payment.js
import { supabase } from "@/utils/supabaseClient";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const {
      name,
      instagram,
      phone,
      service,
      artLevel,
      date,
      time,
      notes,
      returning,
      referral,
    } = req.body;

    // Insert appointment into Supabase (paid: true by default)
    const { data, error } = await supabase.from("bookings").insert([
      {
        name,
        instagram,
        phone,
        service,
        art_level: artLevel,
        date,
        time,
        notes,
        paid: true,
        returning,
        referral,
      },
    ]).select().single();

    if (error) {
      console.error("❌ Supabase insert failed:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Send email only after successful payment and DB insert
    await resend.emails.send({
      from: "Mya's Nails <onboarding@resend.dev>",
      to: ["myasnailsbaby@gmail.com"],
      subject: "New Booking Request 💅",
      html: `
        <h2>New Booking Request!</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Instagram:</strong> ${instagram}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Art Level:</strong> ${artLevel}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Notes:</strong> ${notes}</p>
        <p><strong>Returning Client:</strong> ${returning}</p>
        ${referral ? `<p><strong>Referral:</strong> ${referral}</p>` : ""}
      `,
    });

    return res.status(200).json({ success: true, bookingId: data.id });
  } catch (err) {
    console.error("❌ Unexpected confirm-payment error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
