// File: pages/api/send-reminders.js
import { supabase } from "@/utils/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("name, phone, date, time")
    .eq("date", dateStr);

  if (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }

  const promises = bookings.map(async (b) => {
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
    if (!result.success) {
      console.error(`Failed to send reminder to ${b.phone}:`, result.error);
    }
  });

  await Promise.all(promises);

  res.status(200).json({ success: true });
}
