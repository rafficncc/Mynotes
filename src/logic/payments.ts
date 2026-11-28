import { addDays, addMonths, clampedDate, parseDate, toISODate } from './dates';
import { normalize } from './text';
import { canPayFrom } from './balances';
import type { Account, Bill, EmiPlan, InsurancePolicy, Sip, Transaction } from './types';

/** Payments and money movements made from other screens become real transactions, so balances follow. */

type NewTxn = Omit<Transaction, 'id' | 'createdAt'>;

/** Account to pay from when nothing else is set: the first bank account, else any spendable one. */
export function defaultPayAccount(accounts: Account[]): string | undefined {
  const live = accounts.filter((a) => !a.archived && !a.emergency);
  return (live.find((a) => a.type === 'bank') ?? live.find(canPayFrom))?.id;
}

/** True if a payment with this name was already logged in the last 25 days (avoids double counting). */
export function alreadyPaid(name: string, txns: Transaction[], on: Date): boolean {
  const n = normalize(name);
  const since = toISODate(addDays(on, -25));
  return txns.some((t) => t.date >= since && t.date <= toISODate(on) && [t.merchant, t.note].some((x) => x && normalize(x).includes(n)));
}

export function billPayment(bill: Bill, accounts: Account[], date: string): NewTxn | null {
  const accountId = bill.accountId ?? defaultPayAccount(accounts);
  return accountId ? { type: 'expense', amount: bill.amount, date, accountId, categoryId: bill.categoryId ?? 'other', merchant: bill.name } : null;
}

export function premiumPayment(p: InsurancePolicy, accounts: Account[], date: string): NewTxn | null {
  const accountId = defaultPayAccount(accounts);
  return accountId ? { type: 'expense', amount: p.premium, date, accountId, categoryId: 'insurance', merchant: `${p.name} premium` } : null;
}

/** A loan EMI reduces the loan (transfer bank → loan); card and other EMIs are spends on their account. */
export function emiPayment(plan: EmiPlan, accounts: Account[], date: string): NewTxn | null {
  const target = accounts.find((a) => a.id === plan.accountId);
  const from = defaultPayAccount(accounts);
  if (target?.type === 'loan') return from ? { type: 'transfer', amount: plan.monthlyAmount, date, accountId: from, toAccountId: target.id, note: `${plan.name} EMI` } : null;
  const accountId = target ? target.id : from;
  return accountId ? { type: 'expense', amount: plan.monthlyAmount, date, accountId, categoryId: 'emi', merchant: `${plan.name} EMI` } : null;
}

/**
 * Monthly dates on `day` that are due up to `on`, after `last`. Without a previous run only this
 * month's date counts, so nothing surprising is back-filled.
 */
export function monthlyDueDates(day: number, last: string | undefined, on: Date): string[] {
  const today = toISODate(on);
  let d = last ? addMonths(parseDate(last), 1, day) : clampedDate(on.getFullYear(), on.getMonth(), day);
  const out: string[] = [];
  while (toISODate(d) <= today && out.length < 24) {
    out.push(toISODate(d));
    d = addMonths(d, 1, day);
  }
  return out;
}

/** SIP debits due since the last one recorded: transfers from the bank into the fund. */
export function dueSipTransfers(fund: Account, accounts: Account[], on: Date): NewTxn[] {
  if (fund.archived || !fund.sipAmount || !fund.sipDay) return [];
  const from = defaultPayAccount(accounts);
  if (!from) return [];
  return monthlyDueDates(fund.sipDay, fund.sipLast, on).map((date) => ({ type: 'transfer', amount: fund.sipAmount!, date, accountId: from, toAccountId: fund.id, note: `${fund.name} SIP` }));
}

/** Several SIPs in one account: transfers that fell due, and the SIP list with each one's last date moved on. */
export function dueSipListTransfers(fund: Account, accounts: Account[], on: Date): { txns: NewTxn[]; sips: Sip[] } {
  const from = defaultPayAccount(accounts);
  if (fund.archived || !fund.sips?.length || !from) return { txns: [], sips: fund.sips ?? [] };
  const txns: NewTxn[] = [];
  const sips = fund.sips.map((s) => {
    const dates = monthlyDueDates(s.day, s.last, on);
    for (const date of dates) txns.push({ type: 'transfer', amount: s.amount, date, accountId: from, toAccountId: fund.id, note: `${s.name} SIP` });
    return dates.length ? { ...s, last: dates[dates.length - 1] } : s;
  });
  return { txns, sips };
}

/** Total monthly SIP into an account (old single SIP plus the SIP list). */
export const monthlySip = (a: Account) => (a.sipAmount ?? 0) + (a.sips ?? []).reduce((s, x) => s + x.amount, 0);

/**
 * Interest inside a loan EMI this month (outstanding × yearly rate ÷ 12). Only the rest of the EMI
 * reduces the loan; the interest is recorded as an expense. 0 when the loan or its rate is unknown.
 */
export function emiInterest(plan: EmiPlan, accounts: Account[], balances: Record<string, number>, amount: number): number {
  const loan = accounts.find((a) => a.id === plan.accountId && a.type === 'loan');
  const rate = plan.interestRate ?? loan?.interestRate ?? 0;
  if (!loan || !rate) return 0;
  return Math.min(amount, Math.round((Math.max(0, -(balances[loan.id] ?? 0)) * rate) / 1200));
}
