export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { name, phone, date, start_time } = req.body;

    // Strip non-digits from phone number
    const cleanedPhone = phone.replace(/\D/g, "");

    const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

await twilio.messages.create({
  body: `Hey babes! Your nail appointment with Mya on ${date} @ ${start_time} was canceled. Please dm @myasnailsbaby if you believe this was an error!`,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: cleanedPhone,
});

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel SMS error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
