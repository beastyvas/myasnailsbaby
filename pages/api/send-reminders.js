import { supabase } from "@/utils/supabaseClient";

const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);
// ✅ Safely converts time like "1:25PM" or "2PM" to "13:25:00"
function convertTo24Hr(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "00:00:00";

  const normalized = timeStr.trim().toUpperCase();
  
  // 💡 Handle shorthand like "2PM" → "2:00PM"
  const corrected = /^\d{1,2}(AM|PM)$/.test(normalized)
    ? normalized.replace(/(AM|PM)/, ":00$1")
    : normalized;

  const match = corrected.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!match) {
    // Already in 24hr format like "14:00"
    if (/^\d{1,2}:\d{2}$/.test(normalized)) {
      const [h, m] = normalized.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
    }
    return "00:00:00";
  }

  let [_, hourStr, minuteStr, modifier] = match;
  let hours = parseInt(hourStr);
  const minutes = parseInt(minuteStr);

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  // 🌎 FIXED: Work in Vegas timezone (PST/PDT)
  const now = new Date();
  
  // Convert to Vegas time for calculations
  const vegasTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  console.log("🕐 Current Vegas Time:", vegasTime.toISOString());

  // Look for appointments 24 hours from now (±30 min buffer for safety)
  const targetDate = new Date(vegasTime);
  targetDate.setDate(targetDate.getDate() + 1);
  
  const windowStart = new Date(targetDate.getTime() - 30 * 60 * 1000); // 30 min before
  const windowEnd = new Date(targetDate.getTime() + 30 * 60 * 1000);   // 30 min after

  console.log("⏰ Reminder Window:", windowStart.toISOString(), "to", windowEnd.toISOString());

  // Fetch bookings that haven't received reminders
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, name, phone, date, start_time, reminder_sent")
    .eq("reminder_sent", false);

  if (error) {
    console.error("❌ Error fetching bookings:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }

  console.log("📋 Fetched bookings:", bookings.length);

  // Filter valid bookings
  const safeBookings = bookings.filter((b) => {
    const isValid = b.date && b.start_time && b.phone;
    if (!isValid) {
      console.warn("❌ Invalid booking skipped:", b);
    }
    return isValid;
  });

  console.log("✅ Valid bookings:", safeBookings.length);

  // Find bookings in the 24-hour window
  const upcoming = safeBookings.filter((b) => {
    // Convert booking time to 24hr format
    const time24 = convertTo24Hr(b.start_time);
    
    // Create datetime string in ISO format
    const dateTimeStr = `${b.date}T${time24}`;
    
    // Parse in Vegas timezone
    const bookingTime = new Date(dateTimeStr);
    
    // Adjust for Vegas timezone offset
    const vegasOffset = new Date().toLocaleString("en-US", { 
      timeZone: "America/Los_Angeles",
      timeZoneName: "short" 
    }).includes("PST") ? -8 : -7; // PST or PDT
    
    const utcOffset = bookingTime.getTimezoneOffset() / 60;
    bookingTime.setHours(bookingTime.getHours() + utcOffset + Math.abs(vegasOffset));

    const isInWindow = bookingTime >= windowStart && bookingTime <= windowEnd;
    
    console.log(`🧪 Booking ${b.id}:`, {
      date: b.date,
      start_time: b.start_time,
      converted: time24,
      bookingTime: bookingTime.toISOString(),
      isInWindow,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString()
    });

    return isInWindow;
  });

  console.log("🎯 Bookings in window:", upcoming.length);

  if (upcoming.length === 0) {
    console.log("✅ No reminders to send");
    return res.status(200).json({ 
      success: true, 
      message: "No reminders needed",
      checked: safeBookings.length 
    });
  }

  // Send reminders
  const results = await Promise.allSettled(
    upcoming.map(async (b) => {
      console.log(`📤 Sending reminder to ${b.phone} for booking ${b.id}`);
      
     let result;
try {
  await twilio.messages.create({
    body: `Hi ${b.name}! 💅 This is a reminder that you've got a nail appointment with Mya tomorrow at ${b.start_time}

📍 Address: 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, Nevada

📋 Policy: Please arrive on time. Deposits are non-refundable. Please no extra guests.

DM @myasnailsbaby if anything changes!

See you soon! 💖`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: b.phone,
  });
  result = { success: true };
} catch (error) {
  console.error(`❌ Twilio error for ${b.phone}:`, error.message);
  result = { success: false, error: error.message };
}
      console.log(`📨 Textbelt response for ${b.phone}:`, result);

      if (result.success) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ reminder_sent: true })
          .eq("id", b.id);

        if (updateError) {
          console.error(`❌ Failed to mark reminder as sent for ${b.id}:`, updateError);
        } else {
          console.log(`✅ Marked reminder as sent for booking ${b.id}`);
        }
        
        return { success: true, booking: b.id, phone: b.phone };
      } else {
        console.error(`❌ Failed to send reminder to ${b.phone}:`, result.error);
        return { success: false, booking: b.id, phone: b.phone, error: result.error };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;

  console.log(`✅ Reminders sent: ${successful}, Failed: ${failed}`);

  return res.status(200).json({ 
    success: true,
    sent: successful,
    failed: failed,
    total: upcoming.length,
    details: results
  });
}