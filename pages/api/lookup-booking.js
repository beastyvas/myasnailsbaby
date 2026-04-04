import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const cleanPhone = phone.replace(/\D/g, "");

  try {
    // Find the most recent upcoming booking for this phone number
    // NOTE: no paid filter — lookup should work regardless of payment status
    const today = new Date().toISOString().split("T")[0];

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("phone", cleanPhone)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to lookup booking" });
    }

    if (!bookings || bookings.length === 0) {
      // Also try without date filter in case booking is today or phone format differs
      console.log("No upcoming found, trying without date filter for phone:", formattedPhone);
      return res.status(404).json({ error: "No upcoming booking found for that phone number" });
    }

    const booking = bookings[0];

    // Compute hours until appointment (Vegas time)
    const now = new Date();
    const vegasNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const apptDateTime = new Date(`${booking.date}T${booking.start_time}`);
    const hoursUntil = Math.floor((apptDateTime - vegasNow) / (1000 * 60 * 60));

    // can_reschedule: more than 48 hours away AND under reschedule limit
    const can_reschedule = hoursUntil > 48 && (booking.reschedule_count || 0) < 2;

    return res.status(200).json({
      success: true,
      booking: {
        ...booking,
        hours_until: hoursUntil,
        can_reschedule,
      },
    });
  } catch (err) {
    console.error("Lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
