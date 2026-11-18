import { describe, expect, it } from 'vitest';
import { estimatedRewards, mileage, policyBills, prepayment, repay, trackerDocuments } from './trackers';
import type { Account, Transaction } from './types';

const t = (over: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), type: 'expense', amount: 100, date: '2026-11-01', accountId: 'a', createdAt: '', ...over });

describe('loan prepayment', () => {
  it('repays a 10 lakh loan at 9% with an EMI of 12,668 in about 120 months', () => {
    const p = repay(1_000_000, 9, 12_668);
    expect(p.months).toBe(120);
    expect(p.interest).toBeGreaterThan(510_000);
    expect(p.interest).toBeLessThan(521_000);
  });

  it('shows the saving from a 1 lakh prepayment', () => {
    const r = prepayment(1_000_000, 9, 12_668, 100_000);
    expect(r.shorterTenure.monthsSaved).toBeGreaterThan(15);
    expect(r.shorterTenure.interestSaved).toBeGreaterThan(100_000);
    expect(r.lowerEmi.emi).toBeLessThan(12_668);
    expect(r.lowerEmi.interestSaved).toBeGreaterThan(0);
    expect(r.shorterTenure.interestSaved).toBeGreaterThan(r.lowerEmi.interestSaved); // shorter tenure saves more
  });

  it('flags an EMI that never clears the loan', () => {
    expect(repay(1_000_000, 12, 5_000).months).toBe(Infinity);
  });
});

describe('vehicle mileage', () => {
  it('uses km between fills divided by litres after the first fill', () => {
    const m = mileage(
      [
        t({ vehicleId: 'car', odometer: 10_000, litres: 30, amount: 3000 }),
        t({ vehicleId: 'car', odometer: 10_450, litres: 25, amount: 2500 }),
        t({ vehicleId: 'car', odometer: 10_900, litres: 30, amount: 3000 }),
      ],
      'car',
    );
    expect(m.distance).toBe(900);
    expect(m.kmPerLitre).toBe(16.4);
    expect(m.costPerKm).toBe(6.11);
    expect(m.lastOdometer).toBe(10_900);
  });
});

describe('tracker reminders', () => {
  it('turns policies into bills and renewals into document items', () => {
    const policy = { id: 'p1', type: 'health' as const, name: 'Family health', premium: 24000, frequency: 'yearly' as const, nextDue: '2027-01-10', remindDaysBefore: 30, renewalDate: '2027-01-10' };
    expect(policyBills([policy])[0]).toMatchObject({ id: 'policy:p1', amount: 24000, frequency: 'yearly' });
    const docs = trackerDocuments(
      [{ id: 'v', name: 'Swift', insuranceExpiry: '2026-12-01', pucExpiry: '2026-11-30', remindDaysBefore: 15 }],
      [policy],
      [{ id: 'fd', name: 'FD', type: 'deposit', openingBalance: 1, createdAt: '', maturityDate: '2027-03-01' } as Account],
    );
    expect(docs.map((d) => d.name)).toEqual(['Swift insurance', 'Swift PUC / emission test', 'Family health policy', 'FD maturity']);
  });

  it('estimates card rewards', () => {
    const card = { id: 'c', name: 'Card', type: 'credit_card', openingBalance: 0, createdAt: '', rewardRate: 1.5 } as Account;
    expect(estimatedRewards(card, [t({ accountId: 'c', amount: 10_000, date: '2026-11-02' }), t({ accountId: 'c', amount: 5000, date: '2026-10-01' })], '2026-11-01')).toBe(150);
  });
});
