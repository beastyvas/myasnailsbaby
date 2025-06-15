export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone } = req.body;

  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      message: `❌ Your appointment with Mya has been canceled. If this was unexpected, please DM @myasnailsbaby.`,
      key: process.env.TEXTBELT_API_KEY,
    }),
  });

  const data = await response.json();
  if (!data.success) {
    console.error("Textbelt cancel error:", data.error);
    return res.status(500).json({ success: false });
  }

  res.status(200).json({ success: true });
}
