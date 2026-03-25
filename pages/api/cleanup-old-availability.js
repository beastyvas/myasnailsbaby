import { createClient } from "@supabase/supabase-js";

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { dates } = req.body;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: "No dates provided" });
  }

  try {
    const { error } = await supabase
      .from("availability")
      .delete()
      .in("date", dates);

    if (error) {
      console.error("Failed to delete old dates:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ Deleted ${dates.length} old availability dates`);
    return res.status(200).json({ 
      success: true, 
      deleted: dates.length 
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}