import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";
import { EXPENSE_CATEGORIES } from "@/utils/business";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** POST to log an expense, DELETE ?id= to remove one. */
export default async function handler(req, res) {
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { expense_date, category, description = "", amount_dollars } = req.body ?? {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expense_date ?? ""))) {
    return res.status(400).json({ error: "Pick a date." });
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Pick a category." });
  }

  // Accepts "45", "45.50", "$45.50" — she's typing this on a phone between
  // clients, not filling in an accounting form.
  const amount = Number(String(amount_dollars ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Enter an amount." });
  }

  const { error } = await supabase.from("expenses").insert({
    expense_date,
    category,
    description: String(description).slice(0, 200),
    amount_cents: Math.round(amount * 100),
  });

  if (error) {
    console.error("Expense insert failed:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
