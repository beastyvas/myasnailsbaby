export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { name, date, start_time } = req.body;

  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: "+17029818428", // Mya's number
      message: `📅 New Booking: ${name} on ${date} at ${start_time}`,
      key: process.env.TEXTBELT_API_KEY,
    }),
  });

  const data = await response.json();
  if (!data.success) {
    console.error("Textbelt error:", data.error);
    return res.status(500).json({ success: false, error: data.error });
  }

  res.status(200).json({ success: true });
}
