import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/utils/supabaseClient"; // Add this import

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
      start_time = "",
      duration = 0,
      notes = "",
      returning = "",
      referral = "",
      soakoff = "",
      pedicure = "",
      bookingNails = "",
      pedicureType = "",
    } = req.body;

    // Calculate end time for conflict checking
    const startHour = parseInt(start_time.split(":")[0]);
    const endHour = startHour + duration;
    const end_time = `${endHour.toString().padStart(2, "0")}:00`;

    // Check for double booking conflicts ONLY
    const { data: conflictCheck, error: conflictError } = await supabase
      .from("bookings")
      .select("start_time, duration")
      .eq("date", date)
      .gte("start_time", start_time)
      .lt("start_time", end_time);

    if (conflictError) {
      console.error("Conflict check error:", conflictError);
      return res.status(500).json({ success: false, error: "Failed to check availability" });
    }

    if (conflictCheck && conflictCheck.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: "This time slot is no longer available. Please select a different time." 
      });
    }

    const bookingId = uuidv4();

    // Return success without inserting - webhook will handle the insertion
    return res.status(200).json({
      success: true,
      bookingId,
      bookingMetadata: {
        name,
        instagram,
        phone,
        service,
        artLevel,
        length,
        date,
        start_time,
        duration,
        notes,
        returning,
        referral,
        soakoff,
        pedicure,
        pedicure_type: pedicureType,
        booking_nails: bookingNails,
      },
    });

  } catch (err) {
    console.error("Unexpected error in book.js:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}