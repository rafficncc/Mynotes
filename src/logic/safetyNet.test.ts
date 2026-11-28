import { describe, expect, it } from 'vitest';
import { safetyNet } from './insights';
import { buildDemoData } from './demo';
import type { AppData } from './types';

describe('safety net', () => {
  it('counts only the marked emergency fund, in months of spending, and life cover against 10x income', () => {
    const data: AppData = {
      ...buildDemoData(new Date(2026, 10, 18)),
      accounts: [
        { id: 'bank', name: 'Salary', type: 'bank', openingBalance: 500000, createdAt: '' },
        { id: 'ef', name: 'Emergency fund', type: 'bank', openingBalance: 120000, createdAt: '', emergency: true },
      ],
      settings: { ...buildDemoData(new Date(2026, 10, 18)).settings, emergencyMonths: 6 },
      transactions: ['2026-08-10', '2026-09-10', '2026-10-10'].flatMap((date, i) => [
        { id: `i${i}`, type: 'income' as const, amount: 100000, date, accountId: 'bank', categoryId: 'salary', createdAt: '' },
        { id: `e${i}`, type: 'expense' as const, amount: 40000, date, accountId: 'bank', categoryId: 'groceries', createdAt: '' },
      ]),
      policies: [{ id: 'p', type: 'term', name: 'Term', premium: 10000, frequency: 'yearly', nextDue: '2027-01-01', remindDaysBefore: 15, sumAssured: 6000000 }],
    };
    const n = safetyNet(data, new Date(2026, 10, 18));
    // Only the emergency account counts (not the salary account): 1,20,000 → 3 months of 40,000
    expect(n.emergency).toEqual({ amount: 120000, months: 3, target: 240000, goal: 6 });
    expect(n.protection).toEqual({ cover: 6000000, target: 12000000, times: 5 });
  });
});
