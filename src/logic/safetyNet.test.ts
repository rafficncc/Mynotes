import { describe, expect, it } from 'vitest';
import { safetyNet } from './insights';
import { buildDemoData } from './demo';
import type { AppData } from './types';

describe('safety net', () => {
  it('measures the emergency fund in months of spending and life cover against 10x income', () => {
    const data: AppData = {
      ...buildDemoData(new Date(2026, 10, 18)),
      accounts: [{ id: 'bank', name: 'Bank', type: 'bank', openingBalance: 120000, createdAt: '' }],
      transactions: ['2026-08-10', '2026-09-10', '2026-10-10'].flatMap((date, i) => [
        { id: `i${i}`, type: 'income' as const, amount: 100000, date, accountId: 'bank', categoryId: 'salary', createdAt: '' },
        { id: `e${i}`, type: 'expense' as const, amount: 40000, date, accountId: 'bank', categoryId: 'groceries', createdAt: '' },
      ]),
      policies: [{ id: 'p', type: 'term', name: 'Term', premium: 10000, frequency: 'yearly', nextDue: '2027-01-01', remindDaysBefore: 15, sumAssured: 6000000 }],
    };
    const n = safetyNet(data, new Date(2026, 10, 18));
    // Bank: 1,20,000 + 3 × (1,00,000 − 40,000) = 3,00,000 → 7.5 months of 40,000
    expect(n.emergency).toEqual({ amount: 300000, months: 7.5, target: 240000 });
    expect(n.protection).toEqual({ cover: 6000000, target: 12000000, times: 5 });
  });
});
