export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { name, phone, date, time } = req.body;

    // Strip non-digits from phone number
    const cleanedPhone = phone.replace(/\D/g, "");

    const smsRes = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: cleanedPhone,
        message: `Hey babes! Your nail appointment with Mya on ${date} @ ${time} was canceled. Please dm @myasnailsbaby if you believe this was an error!`,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const smsJson = await smsRes.json();
    if (!smsJson.success) {
      console.error("❌ Textbelt error:", smsJson);
      throw new Error("Textbelt failed");
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel SMS error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
