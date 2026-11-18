import { describe, expect, it } from 'vitest';
import { parseDate } from './dates';
import { alreadyPaid, billPayment, dueSipTransfers, emiPayment, premiumPayment } from './payments';
import type { Account, Transaction } from './types';

const on = parseDate('2026-11-18');
const acc = (id: string, type: Account['type'], extra: Partial<Account> = {}): Account => ({ id, name: id, type, openingBalance: 0, createdAt: '2026-01-01', ...extra });
const accounts = [acc('cash', 'cash'), acc('bank', 'bank'), acc('loan', 'loan'), acc('card', 'credit_card')];

describe('payments from other screens become transactions', () => {
  it('pays bills and premiums from the bank by default', () => {
    expect(billPayment({ id: 'b', name: 'Electricity', type: 'electricity', amount: 2000, frequency: 'monthly', dueDate: '2026-11-08', remindDaysBefore: 3, categoryId: 'utilities' }, accounts, '2026-11-18'))
      .toMatchObject({ type: 'expense', amount: 2000, accountId: 'bank', categoryId: 'utilities', merchant: 'Electricity' });
    expect(premiumPayment({ id: 'p', type: 'health', name: 'Health', premium: 24000, frequency: 'yearly', nextDue: '2026-12-01', remindDaysBefore: 30 }, accounts, '2026-11-18'))
      .toMatchObject({ type: 'expense', amount: 24000, accountId: 'bank', categoryId: 'insurance' });
  });

  it('pays a loan EMI as a transfer that reduces the loan', () => {
    const plan = { id: 'e', name: 'Car loan', kind: 'loan_emi' as const, accountId: 'loan', principal: 1, monthlyAmount: 12500, totalMonths: 60, startDate: '2026-01-05', remindDaysBefore: 3 };
    expect(emiPayment(plan, accounts, '2026-11-18')).toMatchObject({ type: 'transfer', accountId: 'bank', toAccountId: 'loan', amount: 12500 });
    expect(emiPayment({ ...plan, kind: 'card_emi', accountId: 'card' }, accounts, '2026-11-18')).toMatchObject({ type: 'expense', accountId: 'card', categoryId: 'emi' });
  });

  it('spots a payment that was already logged', () => {
    const txns = [{ id: '1', type: 'expense', amount: 2000, date: '2026-11-10', accountId: 'upi', merchant: 'Electricity board', createdAt: '' } as Transaction];
    expect(alreadyPaid('Electricity board', txns, on)).toBe(true);
    expect(alreadyPaid('Home broadband', txns, on)).toBe(false);
  });

  it('records SIP debits once per month as bank → fund transfers', () => {
    const fund = acc('mf', 'investment', { sipAmount: 5000, sipDay: 5 });
    expect(dueSipTransfers(fund, [...accounts, fund], on)).toEqual([{ type: 'transfer', amount: 5000, date: '2026-11-05', accountId: 'bank', toAccountId: 'mf', note: 'mf SIP' }]);
    expect(dueSipTransfers({ ...fund, sipLast: '2026-09-05' }, [...accounts, fund], on).map((t) => t.date)).toEqual(['2026-10-05', '2026-11-05']);
    expect(dueSipTransfers({ ...fund, sipLast: '2026-11-05' }, [...accounts, fund], on)).toEqual([]);
  });
});
