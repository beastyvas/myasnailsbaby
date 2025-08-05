import { supabase } from "@/utils/supabaseClient";

// ✅ Safely converts time like "1:25PM" or "2PM" to "13:25:00"
function convertTo24Hr(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "00:00:00";

  const normalized = timeStr.trim().toUpperCase();
  
  // 💡 Handle shorthand like "2PM" → "2:00PM"
  const corrected = /^\d{1,2}(AM|PM)$/.test(normalized)
    ? normalized.replace(/(AM|PM)/, ":00$1")
    : normalized;

  const match = corrected.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!match) return "00:00:00";

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

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, name, phone, date, start_time, reminder_sent")
    .eq("reminder_sent", false);

  if (error) {
    console.error("❌ Error fetching bookings:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }

  console.log("⏰ Reminder Window:", windowStart.toISOString(), "-", windowEnd.toISOString());
  console.log("📋 Fetched bookings:", bookings.length);

  const safeBookings = bookings.filter((b) => {
    const isValid = b.date && b.start_time && typeof b.start_time === "string";
    if (!isValid) console.warn("❌ Invalid booking skipped:", b);
    return isValid;
  });

  const upcoming = safeBookings.filter((b) => {
    const dt = new Date(`${b.date}T${convertTo24Hr(b.start_time)}`);
    console.log("🧪 Checking booking:", b.id, "→", dt.toISOString());
    return dt >= windowStart && dt <= windowEnd;
  });

  const promises = upcoming.map(async (b) => {
    const response = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: b.phone,
        message: `Hi babe! 💅 This is a reminder that you’ve got a nail appointment with Mya tomorrow at ${b.date} @ ${b.start_time}
📍 Address: 2080 E. Flamingo Rd. Suite #106 Room 4 Las Vegas, Nevada
📋 Policy: 
Please arrive on time. Deposits are non-refundable. 
Please no extra guest. 
DM @myasnailsbaby if anything changes!
See you soon! 💖`,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const result = await response.json();
    console.log("📤 Textbelt response for", b.phone, result);

    if (result.success) {
      await supabase
        .from("bookings")
        .update({ reminder_sent: true })
        .eq("id", b.id);
    } else {
      console.error(`❌ Failed to send reminder to ${b.phone}:`, result.error);
    }
  });

  await Promise.all(promises);

  res.status(200).json({ success: true });
}
