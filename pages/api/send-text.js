export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { name, date, start_time } = req.body;

  const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

try {
  await twilio.messages.create({
    body: `📅 New Booking: ${name} on ${date} at ${start_time}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: "+17029818428", // Mya's number
  });
} catch (error) {
  console.error("Twilio error:", error);
  return res.status(500).json({ success: false, error: error.message });
}

  res.status(200).json({ success: true });
}
