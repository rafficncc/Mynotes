import { describe, expect, it } from 'vitest';
import { parseDate } from './dates';
import { buildDemoData } from './demo';
import { badges, challengeProgress, dueContributions, memberStreaks, nextSaturday } from './motivation';
import type { Transaction } from './types';

const on = parseDate('2026-11-18'); // Wednesday
const data = buildDemoData(on);
const t = (over: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), type: 'expense', amount: 100, date: '2026-11-14', accountId: 'cash', createdAt: '', ...over });

describe('challenges', () => {
  it('no-spend weekend is lost when a treat is bought', () => {
    const base = { ...data, transactions: [t({ categoryId: 'dining', date: '2026-11-15' })] };
    expect(challengeProgress({ id: 'c', type: 'no_spend_weekend', startDate: '2026-11-14' }, base, on).state).toBe('lost');
    expect(challengeProgress({ id: 'c', type: 'no_spend_weekend', startDate: '2026-11-07' }, base, on).state).toBe('won');
    expect(challengeProgress({ id: 'c', type: 'no_spend_weekend', startDate: nextSaturday(on) }, base, on).state).toBe('upcoming');
    expect(nextSaturday(on)).toBe('2026-11-21');
  });

  it('52-week challenge tracks ticked weeks', () => {
    const p = challengeProgress({ id: 'w', type: 'week52', startDate: '2026-11-04', amount: 10, done: [1, 2] }, data, on);
    expect(p.state).toBe('active');
    expect(p.detail).toContain('Week 3');
    expect(p.progress).toBeCloseTo(30 / 13780);
  });
});

describe('badges & streaks', () => {
  it('computes badges and member streaks on demo data', () => {
    const b = badges(data, on);
    expect(b.find((x) => x.id === 'first')?.earned).toBe(true);
    expect(b.length).toBeGreaterThan(8);
    expect(memberStreaks(data, on).map((m) => m.name)).toContain('Priya');
  });
});

describe('automatic goal contributions', () => {
  const goal = { id: 'g', name: 'Trip', target: 50000, saved: 0, autoAmount: 2000, autoDay: 5 };
  it('adds only this month on first run, then every missed month', () => {
    expect(dueContributions(goal, on)).toEqual(['2026-11-05']);
    expect(dueContributions({ ...goal, lastAuto: '2026-08-05' }, on)).toEqual(['2026-09-05', '2026-10-05', '2026-11-05']);
    expect(dueContributions({ ...goal, lastAuto: '2026-11-05' }, on)).toEqual([]);
    expect(dueContributions({ ...goal, saved: 50000 }, on)).toEqual([]);
  });
});
