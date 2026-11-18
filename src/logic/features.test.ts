import { describe, expect, it } from 'vitest';
import { generateActions, nextEmiDate, upcomingReminders } from './actions';
import { inMonth, projectMonthSpend } from './analytics';
import { cardCycleInfo } from './creditCard';
import { cycleBounds, cycleKeyOf, cycleLabel, parseDate, toISODate } from './dates';
import { buildDemoData } from './demo';
import { emiAmount, emiStatus } from './emi';
import { makeInvite, makeUpdate, mergeTransactions, parseInvite, parseUpdate } from './familySync';
import { generateInsights } from './insights';
import { nicePrice, premiumPrice, regionalTips } from './region';
import { billOccurrences, nextBillDate } from './recurring';
import type { Account, Bill, EmiPlan, Transaction } from './types';

const d = parseDate;
const iso = toISODate;
const txn = (over: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), type: 'expense', amount: 100, date: '2026-11-01', accountId: 'a', createdAt: '2026-11-01', ...over });

describe('spending cycle', () => {
  it('starts on salary day', () => {
    expect(cycleKeyOf('2026-11-24', 25)).toBe('2026-10');
    expect(cycleKeyOf('2026-11-25', 25)).toBe('2026-11');
    const { start, end } = cycleBounds('2026-11', 25);
    expect(iso(start)).toBe('2026-11-25');
    expect(iso(end)).toBe('2026-12-24');
    expect(cycleLabel('2026-11', 25)).toContain('25');
  });

  it('groups transactions by cycle', () => {
    const txns = [txn({ date: '2026-11-24' }), txn({ date: '2026-11-25' }), txn({ date: '2026-12-10' })];
    expect(inMonth(txns, '2026-11', 25)).toHaveLength(2);
    expect(inMonth(txns, '2026-11', 1)).toHaveLength(2);
  });

  it('projects over the cycle length', () => {
    // cycle 25 Nov – 24 Dec (30 days); on 4 Dec, 10 days elapsed
    expect(projectMonthSpend(1000, d('2026-12-04'), 25)).toBe(3000);
  });
});

describe('bills', () => {
  const bill = (over: Partial<Bill>): Bill => ({ id: 'b', name: 'Mobile', type: 'mobile', amount: 399, frequency: 'monthly', dueDate: '2026-08-12', remindDaysBefore: 3, ...over });

  it('repeats by frequency', () => {
    expect(billOccurrences(bill({ frequency: 'quarterly' }), d('2027-03-01')).map(iso)).toEqual(['2026-08-12', '2026-11-12', '2027-02-12']);
  });

  it('moves to the next due date after payment (early or late)', () => {
    expect(iso(nextBillDate(bill({}), d('2026-11-11'))!)).toBe('2026-11-12');
    expect(iso(nextBillDate(bill({ lastPaid: '2026-11-09' }), d('2026-11-11'))!)).toBe('2026-12-12');
    expect(iso(nextBillDate(bill({ lastPaid: '2026-11-15' }), d('2026-11-16'))!)).toBe('2026-12-12');
  });

  it('one-time fines disappear once paid', () => {
    expect(nextBillDate(bill({ frequency: 'once', lastPaid: '2026-11-01' }), d('2026-11-11'))).toBeNull();
  });
});

describe('EMI', () => {
  it('computes reducing-balance EMI', () => {
    expect(emiAmount(120000, 0, 12)).toBe(10000);
    expect(emiAmount(100000, 12, 12)).toBeCloseTo(8884.88, 1);
  });

  const plan: EmiPlan = { id: 'e', name: 'TV', kind: 'card_emi', accountId: 'c', transactionId: 't', principal: 30000, monthlyAmount: 5000, totalMonths: 6, startDate: '2026-09-10', remindDaysBefore: 3 };

  it('tracks progress', () => {
    const st = emiStatus(plan, d('2026-11-11'));
    expect(st.done).toBe(3);
    expect(st.remaining).toBe(3);
    expect(iso(st.next!)).toBe('2026-12-10');
  });

  it('bills card EMIs monthly instead of the full purchase', () => {
    const card: Account = { id: 'c', name: 'Card', type: 'credit_card', openingBalance: 0, createdAt: '', billingDay: 5, dueDay: 25 };
    const txns = [txn({ id: 't', accountId: 'c', amount: 30000, date: '2026-09-02', emiPlanId: 'e' })];
    const info = cardCycleInfo(card, txns, -30000, d('2026-11-11'), [plan]);
    // instalments on 10 Sep, 10 Oct billed up to the 5 Nov statement; full 30k not billed
    expect(info.amountDue).toBe(10000);
    expect(info.unbilled).toBe(5000); // 10 Nov instalment goes on the next statement
  });

  it('next loan instalment follows the last payment', () => {
    const loan: EmiPlan = { ...plan, kind: 'loan_emi', transactionId: undefined, lastPaid: '2026-11-08' };
    expect(iso(nextEmiDate(loan, d('2026-11-01'))!)).toBe('2026-12-10');
  });
});

describe('actions & reminders on demo data', () => {
  const on = d('2026-11-12');
  const data = buildDemoData(on);
  const actions = generateActions(data, on);

  it('lists bills, EMIs, card dues and expiring documents', () => {
    const kinds = new Set(actions.map((a) => a.kind));
    expect(kinds.has('bill')).toBe(true);
    expect(kinds.has('emi')).toBe(true);
    expect(kinds.has('document')).toBe(true);
    expect(actions.find((a) => a.title.startsWith('Traffic challan'))?.status).toBe('overdue');
    expect(actions.find((a) => a.title.includes('Visa'))?.status).toBe('due');
    expect(actions.some((a) => a.title.includes('Driving licence'))).toBe(false);
  });

  it('schedules future reminders only', () => {
    const rem = upcomingReminders(data, on);
    expect(rem.length).toBeGreaterThan(3);
    for (const r of rem) expect(r.date.getTime()).toBeGreaterThan(on.getTime());
  });

  it('insights include member allowance and regional tips', () => {
    const ids = generateInsights(data, on).map((i) => i.id);
    expect(ids.some((id) => id.startsWith('region-IN'))).toBe(true);
  });
});

describe('region & premium', () => {
  it('prices premium per currency', () => {
    expect(premiumPrice('INR').amount).toBe(2500);
    expect(premiumPrice('USD').label).toBe('$28.99');
    expect(premiumPrice('AED').amount).toBe(109);
    expect(nicePrice(4650)).toBe(4699);
  });

  it('gives Gulf tips for AED', () => {
    const data = buildDemoData(d('2026-11-12'));
    data.settings.currencyCode = 'AED';
    const tips = regionalTips(data, data.transactions.slice(0, 50));
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0].id.startsWith('region-AE')).toBe(true);
  });
});

describe('family group codes', () => {
  it('round-trips invite and update codes and merges once', () => {
    const data = buildDemoData(d('2026-11-12'));
    data.group = { id: 'g1', name: 'Sharma family', code: 'ABC234', isAdmin: true };
    const inv = parseInvite(makeInvite(data.group, data.members));
    expect(inv.group.name).toBe('Sharma family');
    expect(inv.members.find((m) => m.id === 'wife')?.budget).toBe(8000);

    const code = makeUpdate(data, 'wife');
    const upd = parseUpdate(code, data);
    expect(upd.memberId).toBe('wife');
    const first = mergeTransactions([], upd.transactions, 'fw');
    const again = mergeTransactions(first.merged, upd.transactions, 'fw');
    expect(first.added).toBe(upd.transactions.length);
    expect(again.added).toBe(0);
  });
});

describe('base64 text conversion used by encrypted storage', async () => {
  const { base64ToUtf8, utf8ToBase64 } = await import('./familySync');
  it('round-trips any language', () => {
    const text = JSON.stringify({ note: 'दूध ₹60 · حليب · பால் · പാൽ · 🥛', n: 1 });
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });
});
