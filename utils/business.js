/** Pure aggregation for the Business tab. All money in cents.
 *
 *  Imported by both the API route and the dashboard, so nothing server-only
 *  belongs in here. */

import { monthKey, todayVegas } from "./time.js";

/** The deposit taken online at booking. Everything past it is settled in
 *  person, which is why a visit's real total has to be entered by hand. */
export const DEPOSIT_CENTS = 2000;

/** Forfeited when someone doesn't turn up and Mya charges the card on file. */
export const NO_SHOW_FEE_CENTS = 2500;

export const EXPENSE_CATEGORIES = [
  "supplies",
  "booth rent",
  "tools",
  "education",
  "marketing",
  "software",
  "other",
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * What one appointment earned.
 *
 * Once Mya marks it done she's entered the real total, so that wins. Until
 * then the only figure the system can stand behind is the deposit it
 * actually processed — counting a guessed service price as revenue would
 * make the books lie. A no-show earns the fee if it was charged.
 */
export function bookingRevenue(b) {
  if (b.refunded) return 0;
  if (b.no_show) return b.no_show_charged ? NO_SHOW_FEE_CENTS : 0;
  if (b.collected_cents != null) return b.collected_cents;
  return b.paid ? DEPOSIT_CENTS : 0;
}

/** True once the appointment has happened and wasn't refunded or missed. */
export function isVisit(b, today = todayVegas()) {
  return !!b.confirmed && !b.refunded && !b.no_show && b.date <= today;
}

/**
 * Everything the Business tab shows.
 *
 * @param {Array} bookings  every booking
 * @param {Array} expenses  rows from the expenses table
 * @param {number} taxPercent  what to set aside for taxes
 */
export function buildReport(bookings, expenses, taxPercent = 25) {
  const today = todayVegas();
  const thisMonth = monthKey(today);
  const year = today.slice(0, 4);

  // ── last 6 months, oldest first ───────────────────────────────────────
  const monthly = [];
  const [y0, m0] = today.split("-").map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0 - 1 - i, 1));
    monthly.push({
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getUTCMonth()],
      revenue: 0,
      expenses: 0,
    });
  }
  const byMonth = new Map(monthly.map((m) => [m.month, m]));

  let ytdRevenue = 0;
  let unrecorded = 0; // past visits with no total entered yet
  let visits = 0;
  let noShows = 0;

  for (const b of bookings) {
    if (!b.confirmed || b.refunded || !b.date) continue;
    if (b.date > today) continue; // hasn't happened yet — not revenue

    const amount = bookingRevenue(b);
    const point = byMonth.get(monthKey(b.date));
    if (point) point.revenue += amount;
    if (b.date.startsWith(year)) ytdRevenue += amount;

    if (b.no_show) {
      noShows++;
    } else {
      visits++;
      if (b.collected_cents == null) unrecorded++;
    }
  }

  let ytdExpenses = 0;
  const byCategory = new Map();
  for (const e of expenses) {
    const point = byMonth.get(monthKey(e.expense_date));
    if (point) point.expenses += e.amount_cents;
    if (String(e.expense_date).startsWith(year)) ytdExpenses += e.amount_cents;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_cents);
  }

  const cur = byMonth.get(thisMonth) ?? { revenue: 0, expenses: 0 };
  const curIdx = monthly.findIndex((m) => m.month === thisMonth);
  const last = curIdx > 0 ? monthly[curIdx - 1] : { revenue: 0, expenses: 0 };

  const taxRate = Math.max(0, Math.min(60, Number(taxPercent) || 0)) / 100;
  const monthProfit = cur.revenue - cur.expenses;
  const ytdProfit = ytdRevenue - ytdExpenses;

  // ── what's already on the books but not yet earned ────────────────────
  const upcoming = bookings.filter((b) => b.confirmed && !b.refunded && b.date > today);

  return {
    month: {
      revenue: cur.revenue,
      expenses: cur.expenses,
      profit: monthProfit,
      // Tax comes off profit, not takings — setting aside a share of revenue
      // she's already spent on supplies would over-reserve every month.
      taxSetAside: Math.max(0, Math.round(monthProfit * taxRate)),
    },
    lastMonth: { revenue: last.revenue, expenses: last.expenses },
    yearToDate: {
      revenue: ytdRevenue,
      expenses: ytdExpenses,
      profit: ytdProfit,
      taxSetAside: Math.max(0, Math.round(ytdProfit * taxRate)),
    },
    monthly,
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    pipeline: { count: upcoming.length, value: upcoming.length * DEPOSIT_CENTS },
    counts: { visits, noShows, unrecorded },
    insights: buildInsights({ cur, last, unrecorded, noShows, visits, monthProfit }),
  };
}

/** Plain-language notes worth acting on. Deliberately few — a wall of
 *  observations gets skimmed and then ignored. */
function buildInsights({ cur, last, unrecorded, noShows, visits, monthProfit }) {
  const out = [];

  if (unrecorded > 0) {
    out.push(
      `${unrecorded} past ${unrecorded === 1 ? "appointment is" : "appointments are"} still counted at just the deposit. ` +
        `Add what you actually collected to see real numbers.`
    );
  }

  if (last.revenue > 0 && cur.revenue > 0) {
    const delta = Math.round(((cur.revenue - last.revenue) / last.revenue) * 100);
    if (Math.abs(delta) >= 10) {
      out.push(
        delta > 0
          ? `Revenue is up ${delta}% on last month.`
          : `Revenue is down ${Math.abs(delta)}% on last month.`
      );
    }
  }

  if (monthProfit < 0) {
    out.push("You've spent more than you've brought in this month — worth a look at expenses.");
  }

  if (visits > 0 && noShows / (visits + noShows) > 0.15) {
    out.push(
      `${noShows} no-${noShows === 1 ? "show" : "shows"} against ${visits} visits. ` +
        `Charging the fee on the card you already have on file is the fastest fix.`
    );
  }

  return out;
}

/** "$1,240.00" from cents. */
export function formatMoney(cents, { whole = false } = {}) {
  const n = (Number(cents) || 0) / 100;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}
