import { supabase } from "@/utils/supabaseClient";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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
      returning = "",       // ✅ added
      referral = ""         // ✅ added
    } = req.body;

    const emailResponse = await resend.emails.send({
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

    if (emailResponse.error) {
      console.error("Resend Error:", emailResponse.error);
      return res.status(500).json({ success: false, error: emailResponse.error.message });
    }

    const { error: dbError } = await supabase.from("bookings").insert([
  {
    name,
    instagram,
    service,
    phone,
    art_level: artLevel, // ✅ CORRECT
    date,
    time,
    notes,
    returning,
    referral,
  },
]);


    if (dbError) {
      console.error("Supabase insert error:", dbError.message);
      return res.status(500).json({ success: false, error: dbError.message });
    }

    return res.status(200).json({ success: true, message: "Email sent and booking saved!" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
