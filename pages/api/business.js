import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/utils/requireAdmin";
import { buildReport } from "@/utils/business";

// SERVICE ROLE: expenses runs RLS-on with no policy, so the browser's anon
// key can't read the books directly.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SETTINGS_ID = "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9";

/** GET — the whole Business tab in one round trip. */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");
  if (!(await isAdmin(req, res))) {
    return res.status(401).json({ error: "Unauthorized — must be logged in" });
  }

  const [bookings, expenses, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, name, phone, service, date, start_time, paid, confirmed, refunded, no_show, no_show_charged, collected_cents, completed_at"),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("settings").select("tax_set_aside_percent").eq("id", SETTINGS_ID).single(),
  ]);

  const failure = bookings.error || expenses.error;
  if (failure) {
    console.error("Business report failed:", failure.message);
    return res.status(500).json({ error: failure.message });
  }

  const taxPercent = settings.data?.tax_set_aside_percent ?? 25;
  const report = buildReport(bookings.data || [], expenses.data || [], taxPercent);

  // Past appointments with no total entered — the queue that makes the
  // numbers real. Newest first, since those are freshest in her memory.
  const today = new Date().toISOString().slice(0, 10);
  const needsAmount = (bookings.data || [])
    .filter((b) => b.confirmed && !b.refunded && !b.no_show && b.date <= today && b.collected_cents == null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40)
    .map((b) => ({
      id: b.id,
      name: b.name,
      service: b.service,
      date: b.date,
      start_time: b.start_time,
    }));

  return res.status(200).json({
    ok: true,
    report,
    expenses: expenses.data || [],
    needsAmount,
    taxPercent,
  });
}
