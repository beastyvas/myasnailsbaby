import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { name, date, time } = req.body;

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await client.messages.create({
      body: `💅 New Booking: ${name} on ${date} at ${time}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: "+1-702-981-8428" // change this to Mya's real number
    });

    return res.status(200).json({ success: true, sid: message.sid });
  } catch (err) {
    console.error("Twilio error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
