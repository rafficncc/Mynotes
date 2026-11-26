import { describe, expect, it } from 'vitest';
import { buildDemoData } from './demo';
import { savingsThisYear } from './savings';

describe('savings meter', () => {
  it('adds rewards, card interest-free value and unspent budgets, all non-negative', () => {
    const on = new Date(2026, 10, 25);
    const m = savingsThisYear(buildDemoData(on), on);
    expect(m.total).toBe(m.rewards + m.cardFloat + m.underBudget);
    expect(m.rewards).toBeGreaterThanOrEqual(0);
    expect(m.cardFloat).toBeGreaterThan(0);
    expect(m.total).toBeGreaterThan(0);
  });
  it('is zero with no data', () => {
    const on = new Date(2026, 10, 25);
    const d = buildDemoData(on);
    expect(savingsThisYear({ ...d, transactions: [], budgets: [] }, on).total).toBe(0);
  });
});

describe('savings meter budgets', () => {
  it('skips months with too few entries', () => {
    const on = new Date(2026, 10, 25);
    const d = buildDemoData(on);
    const one = [{ id: 'a', type: 'expense' as const, amount: 100, date: '2026-09-10', accountId: 'cash', categoryId: 'groceries', createdAt: '' }];
    expect(savingsThisYear({ ...d, budgets: [{ categoryId: 'groceries', monthlyLimit: 10000 }], transactions: one }, on).underBudget).toBe(0);
  });
  it('ignores months before tracking started and nets overspending', () => {
    const on = new Date(2026, 10, 25);
    const d = buildDemoData(on);
    const data = {
      ...d,
      settings: { ...d.settings, cycleStartDay: 1 },
      budgets: [{ categoryId: 'groceries', monthlyLimit: 10000 }, { categoryId: 'dining', monthlyLimit: 5000 }],
      transactions: [
        { id: 'a', type: 'expense' as const, amount: 12000, date: '2026-09-10', accountId: 'cash', categoryId: 'groceries', createdAt: '' },
        { id: 'b', type: 'expense' as const, amount: 1000, date: '2026-10-05', accountId: 'cash', categoryId: 'dining', createdAt: '' },
        // small other spends so both months count as tracked
        ...Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, type: 'expense' as const, amount: 1, date: i < 10 ? '2026-09-15' : '2026-10-15', accountId: 'cash', categoryId: 'other', createdAt: '' })),
      ],
    };
    // Sep: 15,000 − 12,000 = 3,000; Oct: 15,000 − 1,000 = 14,000; months before Sep are not counted.
    expect(savingsThisYear(data, on).underBudget).toBe(17000);
  });
});
