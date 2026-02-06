export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, name, oldDate, oldTime, newDate, newTime } = req.body;

  if (!phone || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Format time for display
  function formatTime(time24) {
    if (!time24) return "";
    const [hourStr, minuteStr = "00"] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr}${suffix}`;
  }

  // Format date for display
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Build message based on what changed
  let message = `Hi ${name}! Your appointment with Mya has been updated:\n\n`;
  
  if (oldDate !== newDate) {
    message += `📅 New Date: ${formatDate(newDate)}\n`;
  }
  
  if (oldTime !== newTime) {
    message += `🕐 New Time: ${formatTime(newTime)}\n`;
  }
  
  message += `\n📍 Address: 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, Nevada\n\nDM @myasnailsbaby if you have any questions! 💖`;

  try {
    const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

await twilio.messages.create({
  body: message,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: phone,
});

console.log(`✅ Update SMS sent to ${phone}`);
return res.status(200).json({ success: true });
  } catch (error) {
    console.error('SMS API error:', error);
    return res.status(500).json({ error: 'Failed to send SMS' });
  }
}