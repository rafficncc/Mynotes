import type { Account, Bill, DocumentRecord, InsurancePolicy, Transaction } from './types';

/* ------------------------- Loan prepayment ------------------------- */

export interface LoanPlan {
  months: number;
  interest: number;
}

/** Month-by-month repayment of `principal` at `annualRate`% with a fixed EMI. */
export function repay(principal: number, annualRate: number, emi: number): LoanPlan {
  const r = annualRate / 12 / 100;
  let bal = principal;
  let interest = 0;
  let months = 0;
  while (bal > 0.005 && months < 1200) {
    const i = bal * r;
    if (emi <= i) return { months: Infinity, interest: Infinity }; // EMI never clears the loan
    interest += i;
    bal = bal + i - emi;
    months++;
  }
  return { months, interest: Math.round(interest) };
}

export interface PrepayResult {
  before: LoanPlan;
  /** Keep the EMI, finish earlier */
  shorterTenure: LoanPlan & { monthsSaved: number; interestSaved: number };
  /** Keep the end date, pay a smaller EMI */
  lowerEmi: { emi: number; interest: number; interestSaved: number };
}

export function prepayment(outstanding: number, annualRate: number, emi: number, prepay: number): PrepayResult {
  const before = repay(outstanding, annualRate, emi);
  const after = repay(Math.max(0, outstanding - prepay), annualRate, emi);
  const r = annualRate / 12 / 100;
  const n = before.months;
  const p = Math.max(0, outstanding - prepay);
  const newEmi = r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const lowerInterest = Math.round(newEmi * n - p);
  return {
    before,
    shorterTenure: { ...after, monthsSaved: before.months - after.months, interestSaved: before.interest - after.interest },
    lowerEmi: { emi: Math.round(newEmi), interest: lowerInterest, interestSaved: before.interest - lowerInterest },
  };
}

/* ------------------------- Reminders from trackers ------------------------- */

/** Insurance premiums behave like bills (repeating, remind N days before, mark paid). */
export function policyBills(policies: InsurancePolicy[]): Bill[] {
  return policies.map((p) => ({
    id: `policy:${p.id}`,
    name: `${p.name} premium`,
    type: 'insurance',
    amount: p.premium,
    frequency: p.frequency,
    dueDate: p.nextDue,
    remindDaysBefore: p.remindDaysBefore,
    categoryId: 'insurance',
    lastPaid: p.lastPaid,
    reference: [p.insurer, p.policyNo].filter(Boolean).join(' · ') || undefined,
  }));
}

/** Policy renewals and deposit maturities behave like document expiries. */
export function trackerDocuments(policies: InsurancePolicy[], accounts: Account[]): DocumentRecord[] {
  const out: DocumentRecord[] = [];
  for (const p of policies) {
    if (p.renewalDate) out.push({ id: `policy:${p.id}:renew`, type: 'insurance_policy', name: `${p.name} policy`, expiryDate: p.renewalDate, remindDaysBefore: 30 });
  }
  for (const a of accounts) {
    if (!a.archived && a.maturityDate) out.push({ id: `account:${a.id}:maturity`, type: 'other', name: `${a.name} maturity`, expiryDate: a.maturityDate, remindDaysBefore: 15 });
  }
  return out;
}

/* ------------------------- Card rewards ------------------------- */

/** Estimated reward value earned on a card from spends since a date (spend × reward rate %). */
export function estimatedRewards(card: Account, txns: Transaction[], since: string): number {
  if (!card.rewardRate) return 0;
  const spend = txns.filter((t) => t.type === 'expense' && t.accountId === card.id && t.date >= since).reduce((s, t) => s + t.amount, 0);
  return Math.round((spend * card.rewardRate) / 100);
}
