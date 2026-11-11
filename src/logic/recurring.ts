import { clampedDate, diffDays, parseDate } from './dates';
import { normalize } from './priceBook';
import type { Bill, Transaction } from './types';

export interface DetectedSubscription {
  merchant: string;
  amount: number;
  months: number;
  lastDate: string;
  categoryId?: string;
}

/**
 * Finds merchants charged a similar amount (±10%) in at least 3 different months –
 * typical of OTT, gym, phone and other subscriptions people forget about.
 */
export function detectSubscriptions(txns: Transaction[]): DetectedSubscription[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.merchant) continue;
    const k = normalize(t.merchant);
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), t]);
  }
  const out: DetectedSubscription[] = [];
  for (const list of byMerchant.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const similar = sorted.filter((t) => Math.abs(t.amount - last.amount) <= last.amount * 0.1);
    const months = new Set(similar.map((t) => t.date.slice(0, 7)));
    // A subscription is charged about once a month and (almost) always the same amount.
    if (months.size >= 3 && sorted.length <= months.size + 1 && similar.length >= sorted.length - 1) {
      out.push({
        merchant: last.merchant!.trim(),
        amount: last.amount,
        months: months.size,
        lastDate: last.date,
        categoryId: last.categoryId,
      });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function nextBillDate(bill: Bill, on: Date): Date {
  const thisMonth = clampedDate(on.getFullYear(), on.getMonth(), bill.dueDay);
  if (diffDays(thisMonth, on) >= 0) return thisMonth;
  return clampedDate(on.getFullYear(), on.getMonth() + 1, bill.dueDay);
}

/** True when a bill appears to already have been paid this cycle (an expense with matching name in the last 25 days). */
export function billPaidRecently(bill: Bill, txns: Transaction[], on: Date): boolean {
  const name = normalize(bill.name);
  return txns.some(
    (t) =>
      t.type === 'expense' &&
      ((t.merchant && normalize(t.merchant) === name) || (t.note && normalize(t.note).includes(name))) &&
      diffDays(on, parseDate(t.date)) <= 25 &&
      diffDays(on, parseDate(t.date)) >= 0,
  );
}
