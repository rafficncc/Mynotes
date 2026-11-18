import { generateActions } from './actions';
import { expenses, inMonth, incomes, sum } from './analytics';
import { computeBalances, computeNetWorth } from './balances';
import { addDays, addMonths, currentCycleKey, diffDays, parseDate, shiftMonthKey, toISODate } from './dates';
import { noSplurgeStreak } from './insights';
import { personBalances } from './money2';
import { monthlyDueDates } from './payments';
import type { AppData, Challenge, Goal } from './types';

/* ------------------------- Challenges ------------------------- */

export type ChallengeState = 'upcoming' | 'active' | 'won' | 'lost';

export interface ChallengeProgress {
  state: ChallengeState;
  title: string;
  detail: string;
  /** 0..1 */
  progress: number;
}

export const WEEK52_TOTAL_FACTOR = 1378; // 1 + 2 + … + 52

function wantSpend(data: AppData, from: string, to: string, memberId?: string, categoryId?: string) {
  const wantIds = new Set(data.categories.filter((c) => c.kind === 'want').map((c) => c.id));
  return data.transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.date >= from &&
      t.date <= to &&
      (!memberId || t.memberId === memberId) &&
      (categoryId ? t.categoryId === categoryId : wantIds.has(t.categoryId ?? 'other')),
  );
}

export function challengeProgress(c: Challenge, data: AppData, on: Date, money: (n: number) => string = String): ChallengeProgress {
  const today = toISODate(on);
  const start = parseDate(c.startDate);
  if (c.type === 'week52') {
    const base = c.amount ?? 10;
    const done = c.done ?? [];
    const saved = done.reduce((s, w) => s + w * base, 0);
    const week = Math.min(52, Math.floor(diffDays(on, start) / 7) + 1);
    const target = base * WEEK52_TOTAL_FACTOR;
    return {
      state: done.length === 52 ? 'won' : diffDays(on, start) < 0 ? 'upcoming' : 'active',
      title: '52-week savings challenge',
      detail: `Week ${Math.max(1, week)}: put away ${money(Math.max(1, week) * base)}. Saved ${money(saved)} of ${money(target)}.`,
      progress: saved / target,
    };
  }
  if (c.type === 'save_target') {
    const end = toISODate(addMonths(start, 1, start.getDate()));
    const list = data.transactions.filter((t) => t.date >= c.startDate && t.date < end);
    const saved = sum(incomes(list)) - sum(expenses(list).filter((t) => data.categories.find((x) => x.id === t.categoryId)?.kind !== 'saving'));
    const target = c.amount ?? 1;
    const finished = today >= end;
    return {
      state: saved >= target && finished ? 'won' : finished ? 'lost' : today < c.startDate ? 'upcoming' : 'active',
      title: `Save ${money(target)} in a month`,
      detail: `Saved ${money(Math.max(0, saved))} so far (income minus spending).`,
      progress: Math.max(0, Math.min(1, saved / target)),
    };
  }
  // Weekend (Sat–Sun) or a 7-day period without spending
  const days = c.type === 'no_spend_weekend' ? 2 : 7;
  const end = toISODate(addDays(start, days - 1));
  const slips = wantSpend(data, c.startDate, end, c.memberId, c.type === 'no_category_week' ? c.categoryId : undefined);
  const cat = data.categories.find((x) => x.id === c.categoryId)?.name ?? 'treats';
  const title = c.type === 'no_spend_weekend' ? 'No-spend weekend' : `A week without ${cat.toLowerCase()}`;
  const elapsed = Math.max(0, Math.min(days, diffDays(on, start) + 1));
  if (slips.length) return { state: 'lost', title, detail: `Broken on ${slips[0].date}. Try again next time!`, progress: elapsed / days };
  if (today < c.startDate) return { state: 'upcoming', title, detail: `Starts ${c.startDate}.`, progress: 0 };
  if (today > end) return { state: 'won', title, detail: 'Done – no spends. Well done!', progress: 1 };
  return { state: 'active', title, detail: `${elapsed} of ${days} days clean.`, progress: elapsed / days };
}

/** Next Saturday (or today if it is Saturday). */
export function nextSaturday(on: Date): string {
  return toISODate(addDays(on, (6 - on.getDay() + 7) % 7));
}

/* ------------------------- Badges & streaks ------------------------- */

export interface Badge {
  id: string;
  icon: string;
  title: string;
  detail: string;
  earned: boolean;
}

export function badges(data: AppData, on: Date): Badge[] {
  const sd = data.settings.cycleStartDay ?? 1;
  const lastKey = shiftMonthKey(currentCycleKey(on, sd), -1);
  const last = inMonth(data.transactions, lastKey, sd);
  const income = sum(incomes(last));
  const spent = sum(expenses(last).filter((t) => data.categories.find((c) => c.id === t.categoryId)?.kind !== 'saving'));
  const nw = computeNetWorth(data.accounts, computeBalances(data.accounts, data.transactions));
  const avgMonthly = spent || 1;
  const budgetsKept = data.budgets.length > 0 && data.budgets.every((b) => sum(expenses(last).filter((t) => t.categoryId === b.categoryId)) <= b.monthlyLimit);
  const streak = noSplurgeStreak(data, on);
  const overdue = generateActions(data, on).some((a) => a.status === 'overdue');
  const scans = data.transactions.filter((t) => t.note?.startsWith('Scanned bill') || t.photoUri).length;
  const won = data.challenges.some((c) => challengeProgress(c, data, on).state === 'won');
  const owed = personBalances(data.transactions).some((p) => p.balance < 0);
  const list: Badge[] = [];
  const add = (id: string, icon: string, title: string, detail: string, earned: boolean) => list.push({ id, icon, title, detail, earned });
  add('first', 'flag-outline', 'Getting started', 'Logged your first 10 transactions', data.transactions.length >= 10);
  add('streak7', 'flame-outline', 'Week of restraint', '7 days in a row without treats', streak >= 7);
  add('streak30', 'bonfire-outline', 'Iron will', '30 days in a row without treats', streak >= 30);
  add('budget', 'pie-chart-outline', 'Budget keeper', 'Stayed within every budget last cycle', budgetsKept);
  add('saver', 'trending-up-outline', 'Super saver', 'Saved 20% or more of income last cycle', income > 0 && (income - spent) / income >= 0.2);
  add('emergency', 'umbrella-outline', 'Safety net', 'Cash and bank cover 3 months of expenses', nw.liquid >= avgMonthly * 3);
  add('ontime', 'checkmark-done-outline', 'Always on time', 'Nothing overdue on the Actions list', !overdue && data.bills.length + data.emis.length > 0);
  add('scanner', 'scan-outline', 'Paperless', 'Saved 5 bills with photos', scans >= 5);
  add('challenge', 'trophy-outline', 'Challenge champion', 'Won a savings challenge', won);
  add('goal', 'ribbon-outline', 'Goal getter', 'Reached a savings goal', data.goals.some((g) => g.saved >= g.target));
  add('nodebt', 'happy-outline', 'Owe nobody', 'No money owed to friends or relatives', !owed && data.transactions.length > 0);
  return list;
}

/** No-treat streak for each family member (spends tagged to them). */
export function memberStreaks(data: AppData, on: Date): { id: string; name: string; streak: number }[] {
  return data.members.map((m) => ({
    id: m.id,
    name: m.name,
    streak: noSplurgeStreak({ ...data, transactions: data.transactions.filter((t) => t.memberId === m.id || t.type !== 'expense') }, on),
  }));
}

/* ------------------------- Automatic goal contributions ------------------------- */

/**
 * Monthly contribution dates that are due but not yet added. Without a previous run, only this
 * month's date counts (no surprise back-filling of past months).
 */
export function dueContributions(goal: Goal, on: Date): string[] {
  if (!goal.autoAmount || !goal.autoDay || goal.saved >= goal.target) return [];
  return monthlyDueDates(goal.autoDay, goal.lastAuto, on);
}
