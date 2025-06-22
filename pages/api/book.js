import { supabase } from "@/lib/supabase"; // or wherever your client is
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";


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

    const bookingId = uuidv4(); // ✅ Unique ID

    // ✅ INSERT into Supabase
    const { error } = await supabase.from("bookings").insert([
      {
        id: bookingId, // your table has an "id" column
        name,
        instagram,
        phone,
        service,
        art_level: artLevel,
        date,
        time,
        notes,
        returning,
        referral,
        paid: false, // default
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error.message);
      return res.status(500).json({ success: false, error: "DB insert failed" });
    }

    // ✅ Return data to trigger Stripe session
    return res.status(200).json({
      success: true,
      bookingId, // now a real ID
      bookingMetadata: {
        name,
        instagram,
        phone,
        service,
        artLevel, // use camelCase here (Stripe expects it)
        date,
        time,
        notes,
        returning,
        referral,
      },
    });

  } catch (err) {
    console.error("Unexpected error in book.js:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
