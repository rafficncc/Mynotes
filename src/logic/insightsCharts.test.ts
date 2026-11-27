import { describe, expect, it } from 'vitest';
import { categoryChanges, cumulativeDaily, savingsRates, spendByWeekday } from './analytics';
import { DEFAULT_CATEGORIES } from './defaults';
import type { Transaction } from './types';

const tx = (date: string, amount: number, categoryId = 'groceries', type: Transaction['type'] = 'expense'): Transaction => ({ id: date + amount, type, amount, date, accountId: 'cash', categoryId, createdAt: '' });

describe('insights charts', () => {
  it('builds a running total per day of the cycle', () => {
    expect(cumulativeDaily([tx('2026-11-01', 100), tx('2026-11-03', 50), tx('2026-11-03', 25, 'x', 'income')], new Date(2026, 10, 1), 4)).toEqual([100, 100, 150, 150]);
  });
  it('finds the biggest category changes', () => {
    const ch = categoryChanges([tx('2026-11-02', 900, 'dining'), tx('2026-11-02', 100)], [tx('2026-10-02', 200, 'dining'), tx('2026-10-02', 400)], DEFAULT_CATEGORIES);
    expect(ch[0]).toMatchObject({ key: 'dining', diff: 700 });
    expect(ch[1]).toMatchObject({ key: 'groceries', diff: -300 });
  });
  it('totals spending by weekday, Monday first', () => {
    // 2026-11-23 is a Monday, 2026-11-29 a Sunday
    expect(spendByWeekday([tx('2026-11-23', 10), tx('2026-11-29', 5)])).toEqual([10, 0, 0, 0, 0, 0, 5]);
  });
  it('works out savings rates', () => {
    expect(savingsRates([{ key: 'a', income: 1000, expense: 750 }, { key: 'b', income: 0, expense: 10 }])).toEqual([25, 0]);
  });
});
