import { expenses, FIXED_CATEGORY_IDS, incomes, spendByCategory, spendByMerchant, sum, type Slice } from './analytics';
import { computeBalances, computeNetWorth } from './balances';
import { addDays, monthLabel, parseDate, shiftMonthKey, toISODate } from './dates';
import type { Account, AppData, Category, Transaction } from './types';

export const inRange = (txns: Transaction[], from: string, to: string) => txns.filter((t) => t.date >= from && t.date <= to);

export interface RangeReport {
  income: number;
  expense: number;
  saved: number;
  byCategory: Slice[];
  count: number;
}

export function rangeReport(txns: Transaction[], categories: Category[], from: string, to: string): RangeReport {
  const list = inRange(txns, from, to);
  const income = sum(incomes(list));
  const expense = sum(expenses(list));
  return { income, expense, saved: income - expense, byCategory: spendByCategory(list, categories), count: list.length };
}

export interface CompareRow {
  key: string;
  label: string;
  a: number;
  b: number;
  /** b − a */
  change: number;
  /** Percent change from a to b; null when a is 0 */
  pct: number | null;
}

/** Category-by-category comparison of two date ranges (e.g. last month vs this month). */
export function compareRanges(txns: Transaction[], categories: Category[], a: [string, string], b: [string, string]): CompareRow[] {
  const ca = new Map(spendByCategory(inRange(txns, ...a), categories).map((s) => [s.key, s]));
  const cb = new Map(spendByCategory(inRange(txns, ...b), categories).map((s) => [s.key, s]));
  return [...new Set([...ca.keys(), ...cb.keys()])]
    .map((key) => {
      const va = ca.get(key)?.value ?? 0;
      const vb = cb.get(key)?.value ?? 0;
      return { key, label: (ca.get(key) ?? cb.get(key))!.label, a: va, b: vb, change: vb - va, pct: va ? Math.round(((vb - va) / va) * 100) : null };
    })
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
}

/** Calendar month range for a 'YYYY-MM' key. */
export function monthRange(key: string): [string, string] {
  const [y, m] = key.split('-').map(Number);
  return [`${key}-01`, toISODate(new Date(y, m, 0))];
}

/**
 * Net worth at the end of each of the last `months` months, replaying transactions up to that day.
 * shortcut: property / investment values use today's figure for every month (no valuation history).
 */
export function netWorthHistory(accounts: Account[], txns: Transaction[], on: Date, months = 12): { key: string; label: string; net: number }[] {
  const nowKey = toISODate(on).slice(0, 7);
  const out: { key: string; label: string; net: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(nowKey, -i);
    const end = i === 0 ? toISODate(on) : monthRange(key)[1];
    out.push({ key, label: monthLabel(key), net: Math.round(computeNetWorth(accounts, computeBalances(accounts, txns.filter((t) => t.date <= end))).net) });
  }
  return out;
}

/** Spend in the 7 days ending `end` vs the 7 days before. */
export function weeklySummary(txns: Transaction[], end: Date): { spent: number; previous: number; pct: number | null } {
  const to = toISODate(end);
  const from = toISODate(addDays(end, -6));
  const prevTo = toISODate(addDays(end, -7));
  const prevFrom = toISODate(addDays(end, -13));
  const spent = sum(expenses(inRange(txns, from, to)));
  const previous = sum(expenses(inRange(txns, prevFrom, prevTo)));
  return { spent, previous, pct: previous ? Math.round(((spent - previous) / previous) * 100) : null };
}

export interface YearReview {
  year: number;
  spent: number;
  earned: number;
  saved: number;
  savingsRate: number;
  topCategory?: Slice;
  topMerchant?: { merchant: string; total: number; count: number };
  biggest?: Transaction;
  cheapestMonth?: { key: string; total: number };
  noSpendDays: number;
  transactions: number;
  billsScanned: number;
}

export function yearReview(data: AppData, year: number, on: Date = new Date()): YearReview {
  const y = String(year);
  const list = data.transactions.filter((t) => t.date.startsWith(y));
  const spentList = expenses(list);
  const spent = sum(spentList);
  const earned = sum(incomes(list));
  const months = new Map<string, number>();
  for (const t of spentList) months.set(t.date.slice(0, 7), (months.get(t.date.slice(0, 7)) ?? 0) + t.amount);
  const cheapest = [...months.entries()].sort((a, b) => a[1] - b[1])[0];
  // Days of the year so far with no "want" spending
  const wantIds = new Set(data.categories.filter((c) => c.kind === 'want').map((c) => c.id));
  const splurgeDays = new Set(spentList.filter((t) => wantIds.has(t.categoryId ?? 'other')).map((t) => t.date));
  const last = year === on.getFullYear() ? on : new Date(year, 11, 31);
  let days = 0;
  for (let d = new Date(year, 0, 1); d <= last; d = addDays(d, 1)) if (!splurgeDays.has(toISODate(d))) days++;
  return {
    year,
    spent,
    earned,
    saved: earned - spent,
    savingsRate: earned > 0 ? Math.round(((earned - spent) / earned) * 100) : 0,
    topCategory: spendByCategory(list, data.categories)[0],
    // Shops only: fixed bills like rent and fees are not a "favourite shop".
    topMerchant: spendByMerchant(list.filter((t) => !FIXED_CATEGORY_IDS.includes(t.categoryId ?? '') && data.categories.find((c) => c.id === t.categoryId)?.kind !== 'saving'), 1)[0],
    biggest: [...spentList].sort((a, b) => b.amount - a.amount)[0],
    cheapestMonth: cheapest ? { key: cheapest[0], total: cheapest[1] } : undefined,
    noSpendDays: days,
    transactions: list.length,
    billsScanned: list.filter((t) => t.note?.startsWith('Scanned bill')).length,
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Printable report (HTML → PDF) for a date range. */
export function reportHtml(data: AppData, from: string, to: string, title: string, money: (n: number) => string): string {
  const r = rangeReport(data.transactions, data.categories, from, to);
  const list = inRange(data.transactions, from, to).filter((t) => t.type !== 'transfer').sort((a, b) => a.date.localeCompare(b.date));
  const cat = (id?: string) => data.categories.find((c) => c.id === id)?.name ?? '';
  const acc = (id?: string) => data.accounts.find((a) => a.id === id)?.name ?? '';
  const nw = computeNetWorth(data.accounts, computeBalances(data.accounts, data.transactions.filter((t) => t.date <= to)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#1B1F24;padding:24px;font-size:12px}
    h1{color:#0B6E4F;margin:0}h2{margin-top:24px;border-bottom:2px solid #0B6E4F;padding-bottom:4px;font-size:15px}
    table{width:100%;border-collapse:collapse}td,th{padding:5px 6px;border-bottom:1px solid #E5E7EB;text-align:left}
    .r{text-align:right}.grid{display:flex;gap:12px}.box{flex:1;background:#F4F6F8;border-radius:8px;padding:10px}
    .big{font-size:18px;font-weight:700}.muted{color:#6B7280}
  </style></head><body>
  <h1>FamilyFin report</h1><div class="muted">${esc(title)} · ${parseDate(from).toDateString()} – ${parseDate(to).toDateString()}</div>
  <h2>Summary</h2><div class="grid">
    <div class="box"><div class="muted">Income</div><div class="big">${esc(money(r.income))}</div></div>
    <div class="box"><div class="muted">Spent</div><div class="big">${esc(money(r.expense))}</div></div>
    <div class="box"><div class="muted">Saved</div><div class="big">${esc(money(r.saved))}</div></div>
    <div class="box"><div class="muted">Net worth</div><div class="big">${esc(money(nw.net))}</div></div>
  </div>
  <h2>Spending by category</h2><table>${r.byCategory.map((c) => `<tr><td>${esc(c.label)}</td><td class="r">${esc(money(c.value))}</td><td class="r muted">${r.expense ? Math.round((c.value / r.expense) * 100) : 0}%</td></tr>`).join('')}</table>
  <h2>Transactions (${list.length})</h2><table><tr><th>Date</th><th>Details</th><th>Category</th><th>Account</th><th class="r">Amount</th></tr>
  ${list.map((t) => `<tr><td>${t.date}</td><td>${esc(t.merchant ?? t.note ?? '')}</td><td>${esc(cat(t.categoryId))}</td><td>${esc(acc(t.accountId))}</td><td class="r">${t.type === 'income' ? '+' : '−'}${esc(money(t.amount))}</td></tr>`).join('')}</table>
  </body></html>`;
}
