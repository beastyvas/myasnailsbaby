import { v4 as uuidv4 } from "uuid";

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

    const bookingId = uuidv4(); // generate unique ID for use in webhook insert

    return res.status(200).json({
  success: true,
  bookingId,  // ← important
  bookingMetadata: {
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
  },
});


  } catch (err) {
    console.error("Unexpected error in book.js:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
