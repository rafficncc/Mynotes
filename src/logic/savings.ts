import { expenses, inMonth } from './analytics';
import { interestFreeDays } from './creditCard';
import { currentCycleKey, cycleBounds, parseDate, shiftMonthKey, toISODate } from './dates';
import { estimatedRewards } from './trackers';
import type { AppData } from './types';

/** Interest a savings account pays (% a year), used to value money kept in the bank longer. */
export const SAVINGS_RATE = 4;
/** A cycle counts for budget savings only if at least this many expenses were recorded in it. */
export const MIN_TRACKED = 10;

export interface SavingsMeter {
  total: number;
  /** Card rewards and cashback earned (from each card's reward rate). */
  rewards: number;
  /** Interest earned by keeping money in the bank during cards' interest-free days. */
  cardFloat: number;
  /** Money left unspent against the total budget, in finished cycles that were tracked. */
  underBudget: number;
}

/**
 * What FamilyFin helped the family save from 1 January to `on`. Every part comes from the user's own entries;
 * nothing is counted that the app can't measure (e.g. late fees, whose amounts aren't known).
 */
export function savingsThisYear(data: AppData, on: Date): SavingsMeter {
  const yearStart = `${on.getFullYear()}-01-01`;
  const today = toISODate(on);
  const txns = data.transactions.filter((t) => t.date >= yearStart && t.date <= today);

  const cards = data.accounts.filter((a) => a.type === 'credit_card');
  const rewards = cards.reduce((s, c) => s + estimatedRewards(c, txns, yearStart), 0);

  let cardFloat = 0;
  for (const t of expenses(txns)) {
    const c = cards.find((a) => a.id === t.accountId);
    if (!c?.billingDay || !c.dueDay) continue;
    cardFloat += (t.amount * interestFreeDays(parseDate(t.date), c.billingDay, c.dueDay) * SAVINGS_RATE) / 36500;
  }

  // Per finished cycle that was actually tracked: total budget minus total spent in budgeted categories.
  let underBudget = 0;
  const start = data.settings.cycleStartDay;
  const firstEntry = data.transactions.reduce((m, t) => (t.date < m ? t.date : m), today);
  const budgeted = new Set(data.budgets.map((b) => b.categoryId));
  const limit = data.budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  for (let key = shiftMonthKey(currentCycleKey(on, start), -1); cycleBounds(key, start).start.getFullYear() === on.getFullYear(); key = shiftMonthKey(key, -1)) {
    if (toISODate(cycleBounds(key, start).end) < firstEntry) break;
    const cycle = expenses(inMonth(data.transactions, key, start));
    if (cycle.length < MIN_TRACKED) continue; // a barely-used month would look like a huge saving
    const spent = cycle.filter((t) => budgeted.has(t.categoryId ?? '')).reduce((s, t) => s + t.amount, 0);
    underBudget += Math.max(0, limit - spent);
  }

  const r = { rewards: Math.round(rewards), cardFloat: Math.round(cardFloat), underBudget: Math.round(underBudget) };
  return { ...r, total: r.rewards + r.cardFloat + r.underBudget };
}
