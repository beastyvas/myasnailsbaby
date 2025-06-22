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

   return res.status(200).json({
  success: true,
  bookingId: "TEMP_ID_ONLY_FOR_STRIPE",
  bookingMetadata: {
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
  },
});


  } catch (err) {
    console.error("Unexpected error in book.js:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
