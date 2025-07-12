import { supabase } from "@/utils/supabaseClient";

// ⬅️ Place this up top
function convertTo24Hr(timeStr) {
  // "1:25PM" -> "13:25:00"
  const [time, modifier] = timeStr.trim().toUpperCase().split(/(AM|PM)/);
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, name, phone, date, time, reminder_sent")
    .eq("reminder_sent", false);

  if (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }

  const upcoming = bookings.filter((b) => {
    if (!b.date || !b.time) return false;
    const dt = new Date(`${b.date}T${convertTo24Hr(b.time)}`);
    return dt >= windowStart && dt <= windowEnd;
  });

  const promises = upcoming.map(async (b) => {
    const response = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: b.phone,
        message: `Hi babe! 💅 This is a reminder that you’ve got a nail appointment with Mya tomorrow at ${b.date} @ ${b.time}

📍 Address: 5935 Reflection Point Ct
📋 Policy: 
Please arrive on time. Deposits are non-refundable. 
Please no extra guest. 
DM @myasnailsbaby if anything changes!

See you soon! 💖`,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const result = await response.json();

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
