import { addMonths, diffDays, parseDate, toISODate } from './dates';
import type { EmiPlan } from './types';

/** Standard reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1). With 0% interest it is P/n. */
export function emiAmount(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return principal;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return Math.round((principal / months) * 100) / 100;
  const f = Math.pow(1 + r, months);
  return Math.round(((principal * r * f) / (f - 1)) * 100) / 100;
}

export function instalmentDate(plan: EmiPlan, index: number): Date {
  const start = parseDate(plan.startDate);
  return addMonths(start, index, start.getDate());
}

export function instalmentDates(plan: EmiPlan): Date[] {
  return Array.from({ length: plan.totalMonths }, (_, i) => instalmentDate(plan, i));
}

export interface EmiStatus {
  done: number;
  remaining: number;
  remainingAmount: number;
  totalInterest: number;
  next: Date | null;
  endDate: Date;
  finished: boolean;
}

/** Instalments with a date on or before `on` are treated as paid/billed. */
export function emiStatus(plan: EmiPlan, on: Date): EmiStatus {
  const dates = instalmentDates(plan);
  const done = dates.filter((d) => diffDays(d, on) <= 0).length;
  const remaining = plan.totalMonths - done;
  return {
    done,
    remaining,
    remainingAmount: remaining * plan.monthlyAmount,
    totalInterest: Math.max(0, plan.monthlyAmount * plan.totalMonths - plan.principal),
    next: dates.find((d) => diffDays(d, on) > 0) ?? null,
    endDate: dates[dates.length - 1] ?? parseDate(plan.startDate),
    finished: remaining <= 0,
  };
}

/** Card EMI instalments charged on or before `until` – these appear on card statements. */
export function cardEmiCharges(plans: EmiPlan[], cardId: string, until: Date): { date: Date; amount: number }[] {
  const out: { date: Date; amount: number }[] = [];
  for (const p of plans) {
    if (p.kind !== 'card_emi' || p.accountId !== cardId || !p.transactionId) continue;
    for (const d of instalmentDates(p)) if (diffDays(d, until) <= 0) out.push({ date: d, amount: p.monthlyAmount });
  }
  return out;
}

export const EMI_KIND_LABEL: Record<EmiPlan['kind'], string> = {
  card_emi: 'Credit card EMI',
  loan_emi: 'Loan EMI',
  other: 'Other instalment',
};

export { toISODate };
