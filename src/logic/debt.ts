import type { PersonBalance } from './money2';
import type { Account, EmiPlan } from './types';

/** Typical rates used when the user hasn't entered one (shown as "assumed"). */
export const ASSUMED_RATE = { card: 42, loan: 10 };

export interface Debt {
  id: string;
  name: string;
  kind: 'card' | 'loan' | 'person';
  balance: number;
  /** Interest % per year */
  rate: number;
  rateAssumed: boolean;
  /** Minimum paid every month anyway (card minimum due, loan EMI). */
  minPayment: number;
}

/** Everything the family owes: credit cards and loans with a balance, plus money borrowed from people. */
export function listDebts(accounts: Account[], balances: Record<string, number>, emis: EmiPlan[], people: PersonBalance[]): Debt[] {
  const out: Debt[] = [];
  for (const a of accounts) {
    if (a.archived || (a.type !== 'credit_card' && a.type !== 'loan')) continue;
    const balance = Math.round(-(balances[a.id] ?? 0));
    if (balance <= 0) continue;
    const card = a.type === 'credit_card';
    const rate = a.interestRate ?? (card ? ASSUMED_RATE.card : ASSUMED_RATE.loan);
    const emi = emis.find((e) => e.accountId === a.id && e.kind === 'loan_emi')?.monthlyAmount;
    // Card minimum due is usually ~5% of the balance; a loan without an EMI on file gets 2%.
    const minPayment = Math.min(balance, card ? Math.max(500, balance * 0.05) : emi ?? Math.max(500, balance * 0.02));
    out.push({ id: a.id, name: a.name, kind: card ? 'card' : 'loan', balance, rate, rateAssumed: a.interestRate == null, minPayment: Math.round(minPayment) });
  }
  for (const p of people) {
    if (p.balance < 0) out.push({ id: `person:${p.person}`, name: p.person, kind: 'person', balance: -p.balance, rate: 0, rateAssumed: false, minPayment: 0 });
  }
  return out;
}

export type Method = 'avalanche' | 'snowball';

/** Avalanche: highest interest first (saves the most). Snowball: smallest balance first (quick wins). */
export function orderDebts(debts: Debt[], method: Method): Debt[] {
  return [...debts].sort((a, b) => (method === 'avalanche' ? b.rate - a.rate || a.balance - b.balance : a.balance - b.balance || b.rate - a.rate));
}

export interface PayoffPlan {
  /** Months until everything is paid; null if the payments never catch up with the interest. */
  months: number | null;
  totalInterest: number;
  /** Debts in the order they get cleared, with the month (1 = next month) each one is paid off. */
  steps: { id: string; name: string; month: number }[];
}

/**
 * Month-by-month simulation: interest is added, every debt gets its minimum, and all money left over
 * (the extra amount plus minimums freed by cleared debts) goes to the first unpaid debt in the order.
 */
export function payoffPlan(debts: Debt[], extraPerMonth: number, method: Method): PayoffPlan {
  const order = orderDebts(debts, method);
  const bal = new Map(order.map((d) => [d.id, d.balance]));
  const budget = order.reduce((s, d) => s + d.minPayment, 0) + Math.max(0, extraPerMonth);
  const steps: PayoffPlan['steps'] = [];
  let interest = 0;
  for (let month = 1; month <= 600 && steps.length < order.length; month++) {
    let left = budget;
    for (const d of order) {
      const b = bal.get(d.id)!;
      if (b <= 0) continue;
      const i = (b * d.rate) / 1200;
      interest += i;
      const pay = Math.min(d.minPayment, b + i, left);
      bal.set(d.id, b + i - pay);
      left -= pay;
    }
    for (const d of order) {
      const b = bal.get(d.id)!;
      if (b <= 0.5 || left <= 0) continue;
      const pay = Math.min(left, b);
      bal.set(d.id, b - pay);
      left -= pay;
    }
    for (const d of order) {
      if (bal.get(d.id)! <= 0.5 && !steps.some((s) => s.id === d.id)) {
        bal.set(d.id, 0);
        steps.push({ id: d.id, name: d.name, month });
      }
    }
  }
  const done = steps.length === order.length;
  return { months: done ? Math.max(0, ...steps.map((s) => s.month)) : null, totalInterest: Math.round(interest), steps };
}
