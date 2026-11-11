import { describe, expect, it } from 'vitest';
import { projectMonth } from './analytics';
import { computeBalances, computeNetWorth } from './balances';
import { DEFAULT_CATEGORIES } from './defaults';
import {
  cardCycleInfo,
  dueDateFor,
  goldenWindow,
  interestFreeDays,
  recommendCards,
  statementDateFor,
} from './creditCard';
import { parseDate, toISODate } from './dates';
import { buildDemoData } from './demo';
import { generateInsights, healthScore, noSplurgeStreak } from './insights';
import { compareItems } from './priceBook';
import { detectSubscriptions } from './recurring';
import type { Account, Transaction } from './types';

const d = parseDate;
const iso = toISODate;

const card = (over: Partial<Account>): Account => ({
  id: 'c',
  name: 'Card',
  type: 'credit_card',
  openingBalance: 0,
  createdAt: '2026-01-01',
  billingDay: 5,
  dueDay: 25,
  ...over,
});

const txn = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  type: 'expense',
  amount: 100,
  date: '2026-11-01',
  accountId: 'a',
  createdAt: '2026-11-01',
  ...over,
});

describe('credit card cycle', () => {
  it('puts a purchase on or before billing day on this month statement', () => {
    expect(iso(statementDateFor(d('2026-11-05'), 5))).toBe('2026-11-05');
    expect(iso(statementDateFor(d('2026-11-02'), 5))).toBe('2026-11-05');
  });

  it('moves a purchase after billing day to next month statement', () => {
    expect(iso(statementDateFor(d('2026-11-06'), 5))).toBe('2026-12-05');
  });

  it('due date is in the same month when due day is after billing day', () => {
    expect(iso(dueDateFor(d('2026-11-05'), 25))).toBe('2026-11-25');
  });

  it('due date rolls to next month when due day is before billing day', () => {
    expect(iso(dueDateFor(d('2026-11-18'), 7))).toBe('2026-12-07');
  });

  it('clamps billing day 31 in short months', () => {
    expect(iso(statementDateFor(d('2026-02-10'), 31))).toBe('2026-02-28');
  });

  it('gives max interest-free days the day after billing date', () => {
    // billed on 5th, due 25th → buying on 6th gives till 25th next month
    expect(interestFreeDays(d('2026-11-06'), 5, 25)).toBe(49);
    expect(interestFreeDays(d('2026-11-05'), 5, 25)).toBe(20);
  });

  it('recommends the card with the most interest-free days and enough limit', () => {
    const a = card({ id: 'a', name: 'A', billingDay: 5, dueDay: 25, creditLimit: 100000 });
    const b = card({ id: 'b', name: 'B', billingDay: 10, dueDay: 30, creditLimit: 100000 });
    const recs = recommendCards([a, b], { a: 0, b: 0 }, d('2026-11-06'));
    expect(recs[0].account.id).toBe('a');
    expect(recs[0].freeDays).toBe(49);

    const full = recommendCards([a, b], { a: -99500, b: 0 }, d('2026-11-06'), 1000);
    expect(full.map((r) => r.account.id)).toEqual(['b']);
  });

  it('computes amount due and unbilled', () => {
    const c = card({ id: 'c', billingDay: 5, dueDay: 25, creditLimit: 50000 });
    const txns = [
      txn({ accountId: 'c', amount: 1000, date: '2026-10-20' }),
      txn({ accountId: 'c', amount: 500, date: '2026-11-08' }),
      txn({ type: 'transfer', accountId: 'bank', toAccountId: 'c', amount: 400, date: '2026-11-10' }),
    ];
    const bal = computeBalances([c, { ...c, id: 'bank', type: 'bank' }], txns);
    const info = cardCycleInfo(c, txns, bal.c, d('2026-11-11'));
    expect(info.amountDue).toBe(600);
    expect(info.unbilled).toBe(500);
    expect(iso(info.dueDate)).toBe('2026-11-25');
    expect(info.outstanding).toBe(1100);
    expect(info.available).toBe(48900);
  });
});

describe('balances', () => {
  it('routes linked debit card spends to the bank and handles transfers', () => {
    const accounts: Account[] = [
      { id: 'bank', name: 'Bank', type: 'bank', openingBalance: 1000, createdAt: '' },
      { id: 'debit', name: 'Debit', type: 'debit_card', openingBalance: 0, linkedBankId: 'bank', createdAt: '' },
      { id: 'cash', name: 'Cash', type: 'cash', openingBalance: 0, createdAt: '' },
    ];
    const bal = computeBalances(accounts, [
      txn({ accountId: 'debit', amount: 200 }),
      txn({ type: 'transfer', accountId: 'bank', toAccountId: 'cash', amount: 300 }),
    ]);
    expect(bal.bank).toBe(500);
    expect(bal.cash).toBe(300);
    expect(computeNetWorth(accounts, bal).net).toBe(800);
  });
});

describe('price book', () => {
  it('finds a cheaper shop than the usual one', () => {
    const res = compareItems(
      [
        { id: '1', item: 'Milk', shop: 'A', price: 60, date: '2026-11-01' },
        { id: '2', item: 'milk ', shop: 'A', price: 62, date: '2026-11-05' },
        { id: '3', item: 'Milk', shop: 'B', price: 55, date: '2026-11-03' },
      ],
      d('2026-11-11'),
    );
    expect(res[0].usual.shop).toBe('A');
    expect(res[0].cheapest.shop).toBe('B');
    expect(res[0].savingPerUnit).toBe(7);
  });
});

describe('subscriptions', () => {
  it('detects monthly charges of similar amount', () => {
    const subs = detectSubscriptions([
      txn({ merchant: 'OTT', amount: 499, date: '2026-08-10' }),
      txn({ merchant: 'OTT', amount: 499, date: '2026-09-10' }),
      txn({ merchant: 'ott', amount: 499, date: '2026-10-10' }),
      txn({ merchant: 'Grocer', amount: 300, date: '2026-10-10' }),
    ]);
    expect(subs).toHaveLength(1);
    expect(subs[0].merchant).toBe('ott');
  });
});

describe('insights on demo data', () => {
  const on = d('2026-11-20');
  const data = buildDemoData(on);

  it('produces actionable suggestions', () => {
    const ins = generateInsights(data, on);
    const ids = ins.map((i) => i.id);
    expect(ids).toContain('subscriptions');
    expect(ids.some((id) => id.startsWith('shop-'))).toBe(true);
    expect(ids).toContain('best-card-today');
    for (const i of ins) expect(i.title.length).toBeGreaterThan(0);
  });

  it('scores financial health between 0 and 100', () => {
    const h = healthScore(data, on);
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(100);
    expect(h.parts).toHaveLength(4);
  });

  it('computes a streak without crashing', () => {
    expect(noSplurgeStreak(data, on)).toBeGreaterThanOrEqual(0);
  });
});

describe('projection & golden window', () => {
  it('counts rent once but extrapolates daily spending', () => {
    const txns = [
      txn({ categoryId: 'rent', amount: 18000, date: '2026-11-03' }),
      txn({ categoryId: 'dining', amount: 1000, date: '2026-11-05' }),
    ];
    // 10 days into a 30-day month: 18000 + 1000 * 3
    expect(projectMonth(txns, DEFAULT_CATEGORIES, d('2026-11-10'))).toBe(21000);
  });

  it('shows the upcoming golden window once the current one has passed', () => {
    const c = card({ billingDay: 5, dueDay: 25 });
    expect(iso(goldenWindow(c, d('2026-11-07'))!.start)).toBe('2026-11-06');
    expect(iso(goldenWindow(c, d('2026-11-11'))!.start)).toBe('2026-12-06');
  });
});
