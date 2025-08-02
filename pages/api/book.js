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
      length = "",
      date = "",
      time = "",
      notes = "",
      returning = "",
      referral = "",
      soakoff = "",
      pedicure = "",
      bookingNails = "", // default to "no" if not provided
      pedicureType = "", // new field for pedicure type

    } = req.body;

    const bookingId = uuidv4(); // generate unique ID for use in webhook insert

    return res.status(200).json({
  success: true,
  bookingId,   // ← important
  bookingMetadata: {
    name,
    instagram,
    phone,
    service,
    artLevel,
    length,
    date,
    time,
    notes,
    returning,
    referral,
    soakoff,
    pedicure,
    pedicure_type: pedicureType, // new field
    booking_nails: bookingNails, // new field
  },
});


  } catch (err) {
    console.error("Unexpected error in book.js:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
