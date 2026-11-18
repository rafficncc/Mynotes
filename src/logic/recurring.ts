import { addDays, addMonths, diffDays, parseDate } from './dates';
import { normalize } from './text';
import type { Bill, BillType, Frequency, Transaction } from './types';

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

const FREQ_MONTHS: Record<Exclude<Frequency, 'once'>, number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Every 3 months',
  half_yearly: 'Every 6 months',
  yearly: 'Yearly',
  once: 'One time',
};

/** All due dates of a bill from its anchor date up to `until`. */
export function billOccurrences(bill: Pick<Bill, 'dueDate' | 'frequency'>, until: Date): Date[] {
  const anchor = parseDate(bill.dueDate);
  if (bill.frequency === 'once') return diffDays(anchor, until) <= 0 ? [anchor] : [];
  const step = FREQ_MONTHS[bill.frequency];
  const out: Date[] = [];
  for (let k = 0; k < 1200; k++) {
    const d = addMonths(anchor, k * step, anchor.getDate());
    if (diffDays(d, until) > 0) break;
    out.push(d);
  }
  return out;
}

/** First occurrence on/after `from` (or the single date of a one-time bill). */
export function firstOccurrenceFrom(bill: Pick<Bill, 'dueDate' | 'frequency'>, from: Date): Date | null {
  const anchor = parseDate(bill.dueDate);
  if (bill.frequency === 'once') return anchor;
  if (diffDays(anchor, from) >= 0) return anchor;
  const step = FREQ_MONTHS[bill.frequency];
  for (let k = 1; k < 1200; k++) {
    const d = addMonths(anchor, k * step, anchor.getDate());
    if (diffDays(d, from) >= 0) return d;
  }
  return null;
}

/**
 * Next unpaid due date. A payment covers the due date nearest after it (or one up to 20 days
 * before it, for late payments), so the next one is the occurrence after that.
 * Without any payment, it is the first due date on/after `from`. Paid one-time bills return null.
 */
export function nextBillDate(bill: Bill, on: Date, from: Date = on): Date | null {
  if (bill.frequency === 'once') return bill.lastPaid ? null : parseDate(bill.dueDate);
  if (bill.lastPaid) {
    const covered = firstOccurrenceFrom(bill, addDays(parseDate(bill.lastPaid), -20));
    return covered ? firstOccurrenceFrom(bill, addDays(covered, 1)) : null;
  }
  return firstOccurrenceFrom(bill, from);
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

export const BILL_TYPES: { key: BillType; label: string; icon: string; categoryId: string }[] = [
  { key: 'mobile', label: 'Mobile', icon: 'phone-portrait-outline', categoryId: 'telecom' },
  { key: 'internet', label: 'Internet / Wi-Fi', icon: 'wifi-outline', categoryId: 'telecom' },
  { key: 'electricity', label: 'Electricity', icon: 'flash-outline', categoryId: 'utilities' },
  { key: 'water', label: 'Water', icon: 'water-outline', categoryId: 'utilities' },
  { key: 'gas', label: 'Gas', icon: 'flame-outline', categoryId: 'utilities' },
  { key: 'rent', label: 'Rent', icon: 'home-outline', categoryId: 'rent' },
  { key: 'school', label: 'School fees', icon: 'school-outline', categoryId: 'education' },
  { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline', categoryId: 'insurance' },
  { key: 'tax', label: 'Tax', icon: 'library-outline', categoryId: 'govt' },
  { key: 'fine', label: 'Fine / challan', icon: 'alert-circle-outline', categoryId: 'govt' },
  { key: 'government', label: 'Govt fee', icon: 'business-outline', categoryId: 'govt' },
  { key: 'subscription', label: 'Subscription', icon: 'repeat-outline', categoryId: 'subscriptions' },
  { key: 'other', label: 'Other', icon: 'receipt-outline', categoryId: 'other' },
];

export function billTypeInfo(type: BillType) {
  return BILL_TYPES.find((b) => b.key === type) ?? BILL_TYPES[BILL_TYPES.length - 1];
}
