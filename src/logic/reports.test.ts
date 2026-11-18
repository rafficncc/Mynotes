import { describe, expect, it } from 'vitest';
import { parseDate } from './dates';
import { buildDemoData } from './demo';
import { compareRanges, monthRange, netWorthHistory, rangeReport, reportHtml, weeklySummary, yearReview } from './reports';
import type { Transaction } from './types';

const on = parseDate('2026-11-18');
const data = buildDemoData(on);
const t = (over: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), type: 'expense', amount: 100, date: '2026-11-15', accountId: 'cash', createdAt: '', ...over });

describe('reports', () => {
  it('totals a date range', () => {
    const r = rangeReport(data.transactions, data.categories, '2026-10-01', '2026-10-31');
    expect(r.income).toBe(85000);
    expect(r.expense).toBeGreaterThan(0);
    expect(r.saved).toBe(r.income - r.expense);
  });

  it('compares two months by category', () => {
    const rows = compareRanges([t({ categoryId: 'dining', amount: 200, date: '2026-10-05' }), t({ categoryId: 'dining', amount: 300, date: '2026-11-05' })], data.categories, monthRange('2026-10'), monthRange('2026-11'));
    expect(rows[0]).toMatchObject({ key: 'dining', a: 200, b: 300, change: 100, pct: 50 });
    expect(monthRange('2026-02')).toEqual(['2026-02-01', '2026-02-28']);
  });

  it('builds a 12-month net worth history ending today', () => {
    const h = netWorthHistory(data.accounts, data.transactions, on);
    expect(h).toHaveLength(12);
    expect(h[11].key).toBe('2026-11');
  });

  it('compares this week with last week', () => {
    const w = weeklySummary([t({ amount: 300, date: '2026-11-17' }), t({ amount: 600, date: '2026-11-08' })], on);
    expect(w).toEqual({ spent: 300, previous: 600, pct: -50 });
  });

  it('summarises the year', () => {
    const y = yearReview(data, 2026, on);
    expect(y.spent).toBeGreaterThan(0);
    expect(y.topCategory).toBeDefined();
    expect(y.noSpendDays).toBeGreaterThan(0);
  });

  it('escapes text in the PDF report', () => {
    const html = reportHtml({ ...data, transactions: [t({ merchant: '<b>Shop & Co</b>' })] }, '2026-11-01', '2026-11-30', 'November', String);
    expect(html).toContain('&lt;b&gt;Shop &amp; Co&lt;/b&gt;');
  });
});
