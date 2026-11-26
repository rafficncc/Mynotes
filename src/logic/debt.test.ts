import { describe, expect, it } from 'vitest';
import { listDebts, payoffPlan, type Debt } from './debt';
import type { Account } from './types';

const debts: Debt[] = [
  { id: 'card', name: 'Card', kind: 'card', balance: 50000, rate: 42, rateAssumed: false, minPayment: 2500 },
  { id: 'loan', name: 'Car loan', kind: 'loan', balance: 20000, rate: 9, rateAssumed: false, minPayment: 2000 },
  { id: 'p', name: 'Ravi', kind: 'person', balance: 5000, rate: 0, rateAssumed: false, minPayment: 0 },
];

describe('debt payoff planner', () => {
  it('highest-interest first clears the card first and costs less interest than smallest first', () => {
    const av = payoffPlan(debts, 5000, 'avalanche');
    const sn = payoffPlan(debts, 5000, 'snowball');
    expect(av.steps[0].id).toBe('card');
    expect(sn.steps[0].id).toBe('p');
    expect(av.months).not.toBeNull();
    expect(av.totalInterest).toBeLessThan(sn.totalInterest);
    expect(av.steps).toHaveLength(3);
  });
  it('extra money clears debts sooner', () => {
    expect(payoffPlan(debts, 10000, 'avalanche').months!).toBeLessThan(payoffPlan(debts, 0, 'avalanche').months!);
  });
  it('reports never when payments cannot beat the interest', () => {
    expect(payoffPlan([{ ...debts[0], minPayment: 100 }], 0, 'avalanche').months).toBeNull();
  });
  it('lists cards and loans with a balance and money borrowed from people', () => {
    const acc = (id: string, type: Account['type']): Account => ({ id, name: id, type, openingBalance: 0, createdAt: '' });
    const list = listDebts([acc('c', 'credit_card'), acc('l', 'loan'), acc('b', 'bank')], { c: -10000, l: -50000, b: 9000 }, [], [{ person: 'Anu', balance: -1500, last: '', count: 1 }]);
    expect(list.map((d) => d.id)).toEqual(['c', 'l', 'person:Anu']);
    expect(list[0].rateAssumed).toBe(true);
  });
});
