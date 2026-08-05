import { isAdmin } from "@/utils/requireAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  // ✅ AUTHENTICATION CHECK - critical for data deletion
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: 'Unauthorized — must be logged in' });
  }

  const today = new Date().toISOString().split("T")[0]; // e.g. "2025-06-13"

  const { error } = await supabase
    .from("bookings")
    .delete()
    .lt("date", today); // delete where date is before today

  if (error) {
    console.error("Failed to delete past bookings:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true });
}