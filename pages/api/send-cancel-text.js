import textbelt from "textbelt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { name, phone, date, time } = req.body;

    const smsRes = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        message: `Hi! Your nail appointment with Mya on ${date} @ ${time} was canceled.`,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const smsJson = await smsRes.json();
    if (!smsJson.success) throw new Error("Text failed");

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel SMS error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
