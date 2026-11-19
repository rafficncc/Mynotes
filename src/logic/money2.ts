import { normalize } from './text';
import type { Transaction } from './types';

/* ------------------------- Lend & borrow ------------------------- */

export const PEOPLE_ACCOUNT_ID = 'people';

export interface PersonBalance {
  person: string;
  /** Positive: they owe you. Negative: you owe them. */
  balance: number;
  last: string;
  count: number;
}

/**
 * Money lent / borrowed is a transfer to / from the "People" account tagged with a person.
 * Money going to People (you lent, or you repaid them) raises what they owe you.
 */
export function personBalances(txns: Transaction[]): PersonBalance[] {
  const map = new Map<string, PersonBalance>();
  for (const t of txns) {
    if (t.type !== 'transfer' || !t.person) continue;
    const sign = t.toAccountId === PEOPLE_ACCOUNT_ID ? 1 : t.accountId === PEOPLE_ACCOUNT_ID ? -1 : 0;
    if (!sign) continue;
    const k = normalize(t.person);
    const cur = map.get(k) ?? { person: t.person.trim(), balance: 0, last: t.date, count: 0 };
    cur.balance = Math.round((cur.balance + sign * t.amount) * 100) / 100;
    cur.last = t.date > cur.last ? t.date : cur.last;
    cur.count++;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

/** Splits a bill equally between you and the people named; your share gets the leftover paisa/cents. */
export function splitEqually(total: number, people: string[]): { mine: number; each: number } {
  const n = people.length + 1;
  const each = Math.floor((total / n) * 100) / 100;
  return { each, mine: Math.round((total - each * people.length) * 100) / 100 };
}

/* ------------------------- Foreign currency & remittance ------------------------- */

/** Most recent rate used for a currency (to pre-fill the next entry). */
export function lastRate(txns: Transaction[], currency: string): number | undefined {
  return [...txns].filter((t) => t.fx?.currency === currency).sort((a, b) => b.date.localeCompare(a.date))[0]?.fx?.rate;
}

export interface RemittanceStats {
  count: number;
  sent: number;
  fees: number;
  received: number;
  /** Received per 1 unit sent, after fees */
  effectiveRate: number;
  bestRate: number;
  currency?: string;
}

/** Remittances are expenses in the "remittance" category whose fx holds the amount received at home. */
export function remittanceStats(txns: Transaction[]): RemittanceStats {
  const list = txns.filter((t) => t.type === 'expense' && t.categoryId === 'remittance' && t.fx);
  const sent = list.reduce((s, t) => s + t.amount, 0);
  const fees = list.reduce((s, t) => s + (t.fee ?? 0), 0);
  const received = list.reduce((s, t) => s + t.fx!.amount, 0);
  return {
    count: list.length,
    sent,
    fees,
    received,
    effectiveRate: sent > 0 ? received / sent : 0,
    bestRate: Math.max(0, ...list.map((t) => t.fx!.rate)),
    currency: list[0]?.fx?.currency,
  };
}

/**
 * How a transaction moves your money, for lists: -1 money out (red), +1 money in (green), 0 a move between your own accounts.
 * Lending or repaying someone is money out; borrowing or being repaid is money in.
 */
export function txnSign(t: Transaction): -1 | 0 | 1 {
  if (t.type === 'expense') return -1;
  if (t.type === 'income') return 1;
  if (t.toAccountId === PEOPLE_ACCOUNT_ID) return -1;
  if (t.accountId === PEOPLE_ACCOUNT_ID) return 1;
  return 0;
}
