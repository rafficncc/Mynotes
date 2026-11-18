import { describe, expect, it } from 'vitest';
import { lastRate, PEOPLE_ACCOUNT_ID, personBalances, remittanceStats, splitEqually } from './money2';
import type { Transaction } from './types';

const t = (over: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), type: 'transfer', amount: 100, date: '2026-11-01', accountId: 'bank', createdAt: '', ...over });

describe('lend & borrow', () => {
  it('nets lending, borrowing and repayments per person', () => {
    const b = personBalances([
      t({ toAccountId: PEOPLE_ACCOUNT_ID, person: 'Ravi', amount: 5000 }), // lent
      t({ accountId: PEOPLE_ACCOUNT_ID, toAccountId: 'bank', person: 'ravi ', amount: 2000, date: '2026-11-05' }), // paid back
      t({ accountId: PEOPLE_ACCOUNT_ID, toAccountId: 'cash', person: 'Anu', amount: 1500 }), // borrowed
    ]);
    expect(b.find((x) => x.person === 'Ravi')).toMatchObject({ balance: 3000, last: '2026-11-05', count: 2 });
    expect(b.find((x) => x.person === 'Anu')?.balance).toBe(-1500);
  });

  it('splits equally, rounding in my share', () => {
    expect(splitEqually(1000, ['A', 'B'])).toEqual({ each: 333.33, mine: 333.34 });
  });
});

describe('currency & remittance', () => {
  it('remembers the last rate and sums remittances', () => {
    const txns = [
      t({ type: 'expense', categoryId: 'remittance', amount: 1015, fee: 15, fx: { currency: 'INR', amount: 22500, rate: 22.5 }, date: '2026-10-01' }),
      t({ type: 'expense', categoryId: 'remittance', amount: 2020, fee: 20, fx: { currency: 'INR', amount: 45400, rate: 22.7 }, date: '2026-11-01' }),
    ];
    expect(lastRate(txns, 'INR')).toBe(22.7);
    const s = remittanceStats(txns);
    expect(s).toMatchObject({ count: 2, sent: 3035, fees: 35, received: 67900, bestRate: 22.7, currency: 'INR' });
    expect(s.effectiveRate).toBeCloseTo(22.37, 2);
  });
});
