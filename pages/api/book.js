// File: /pages/api/book.js
import { supabase } from "@/utils/supabaseClient";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const {
      name = "",
      instagram = "",
      phone = "",
      service = "",
      artLevel = "",
      date = "",
      time = "",
      notes = "",
      returning = "",
      referral = "",
    } = req.body;

    // Insert into Supabase
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
        paid: false, // default unpaid
        returning,
        referral,
      },
    ]).select().single();

    if (error) {
      console.error("Supabase insert error:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Send confirmation email to Mya
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
    console.error("Unexpected error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
