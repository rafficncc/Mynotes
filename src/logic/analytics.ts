import { daysInMonth, monthKey, parseDate, shiftMonthKey } from './dates';
import type { Account, AccountType, Category, Transaction } from './types';

export const expenses = (txns: Transaction[]) => txns.filter((t) => t.type === 'expense');
export const incomes = (txns: Transaction[]) => txns.filter((t) => t.type === 'income');

export function inMonth(txns: Transaction[], key: string): Transaction[] {
  return txns.filter((t) => monthKey(t.date) === key);
}

export function sum(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + t.amount, 0);
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function spendByCategory(txns: Transaction[], categories: Category[]): Slice[] {
  const map = new Map<string, number>();
  for (const t of expenses(txns)) {
    const k = t.categoryId ?? 'other';
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([key, value]) => {
      const c = categories.find((x) => x.id === key);
      return { key, value, label: c?.name ?? 'Other', color: c?.color ?? '#9E9E9E' };
    })
    .sort((a, b) => b.value - a.value);
}

const TYPE_COLOR: Record<AccountType, string> = {
  cash: '#43A047',
  bank: '#1E88E5',
  debit_card: '#00ACC1',
  credit_card: '#E53935',
  wallet: '#8E24AA',
  other: '#757575',
};

const TYPE_LABEL: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank / Net banking',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  wallet: 'UPI / Wallet',
  other: 'Other',
};

export function spendByPaymentMode(txns: Transaction[], accounts: Account[]): Slice[] {
  const map = new Map<AccountType, number>();
  for (const t of expenses(txns)) {
    const type = accounts.find((a) => a.id === t.accountId)?.type ?? 'other';
    map.set(type, (map.get(type) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, value, label: TYPE_LABEL[key], color: TYPE_COLOR[key] }))
    .sort((a, b) => b.value - a.value);
}

export function spendByMerchant(txns: Transaction[], limit = 8): { merchant: string; total: number; count: number }[] {
  const map = new Map<string, { merchant: string; total: number; count: number }>();
  for (const t of expenses(txns)) {
    if (!t.merchant) continue;
    const k = t.merchant.trim().toLowerCase();
    const cur = map.get(k) ?? { merchant: t.merchant.trim(), total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export function spendByMember(
  txns: Transaction[],
  members: { id: string; name: string }[],
): { id: string; name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of expenses(txns)) {
    const k = t.memberId ?? '_family';
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([id, total]) => ({ id, total, name: members.find((m) => m.id === id)?.name ?? 'Whole family' }))
    .sort((a, b) => b.total - a.total);
}

export interface MonthTotals {
  key: string;
  income: number;
  expense: number;
}

export function monthlyTotals(txns: Transaction[], endKey: string, months = 6): MonthTotals[] {
  const out: MonthTotals[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(endKey, -i);
    const m = inMonth(txns, key);
    out.push({ key, income: sum(incomes(m)), expense: sum(expenses(m)) });
  }
  return out;
}

export function weekdayVsWeekend(txns: Transaction[]): { weekdayAvg: number; weekendAvg: number } {
  const daily = new Map<string, number>();
  for (const t of expenses(txns)) daily.set(t.date, (daily.get(t.date) ?? 0) + t.amount);
  let wd = 0, wdn = 0, we = 0, wen = 0;
  for (const [d, amt] of daily) {
    const day = parseDate(d).getDay();
    if (day === 0 || day === 6) { we += amt; wen++; } else { wd += amt; wdn++; }
  }
  return { weekdayAvg: wdn ? wd / wdn : 0, weekendAvg: wen ? we / wen : 0 };
}

/** Projects full-month spend from the spend so far this month. */
export function projectMonthSpend(spentSoFar: number, on: Date): number {
  const dim = daysInMonth(on.getFullYear(), on.getMonth());
  const day = on.getDate();
  return day > 0 ? (spentSoFar / day) * dim : spentSoFar;
}

/** Categories usually paid once a month – they should not be extrapolated by day. */
export const FIXED_CATEGORY_IDS = ['rent', 'education', 'insurance', 'utilities', 'subscriptions'];

/** Month-end projection that counts fixed bills once and extrapolates only day-to-day spending. */
export function projectMonth(monthTxns: Transaction[], categories: Category[], on: Date): number {
  let fixed = 0;
  let variable = 0;
  for (const t of expenses(monthTxns)) {
    const kind = categories.find((c) => c.id === t.categoryId)?.kind;
    if (kind === 'saving' || FIXED_CATEGORY_IDS.includes(t.categoryId ?? '')) fixed += t.amount;
    else variable += t.amount;
  }
  return fixed + projectMonthSpend(variable, on);
}

/** Splits spend into needs / wants / savings for the 50-30-20 rule. */
export function needsWantsSavings(txns: Transaction[], categories: Category[]) {
  let needs = 0, wants = 0, savings = 0;
  for (const t of expenses(txns)) {
    const kind = categories.find((c) => c.id === t.categoryId)?.kind ?? 'want';
    if (kind === 'need') needs += t.amount;
    else if (kind === 'saving') savings += t.amount;
    else wants += t.amount;
  }
  return { needs, wants, savings };
}
