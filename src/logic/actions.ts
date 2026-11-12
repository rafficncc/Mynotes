import { computeBalances } from './balances';
import { cardCycleInfo, isCreditCardConfigured } from './creditCard';
import { addDays, currentCycleKey, cycleBounds, diffDays, parseDate, toISODate } from './dates';
import { instalmentDates } from './emi';
import { billOccurrences, billPaidRecently, billTypeInfo, firstOccurrenceFrom, nextBillDate } from './recurring';
import type { AppData, Bill, DocumentType, EmiPlan } from './types';

export type ActionStatus = 'overdue' | 'due' | 'upcoming' | 'done';
export type ActionKind = 'card' | 'bill' | 'emi' | 'document';

export interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  subtitle: string;
  date: Date;
  remindOn: Date;
  amount?: number;
  status: ActionStatus;
  icon: string;
  billId?: string;
  emiId?: string;
  accountId?: string;
  documentId?: string;
}

export const DOCUMENT_TYPES: { key: DocumentType; label: string; icon: string; remind: number }[] = [
  { key: 'passport', label: 'Passport', icon: 'airplane-outline', remind: 180 },
  { key: 'visa', label: 'Visa', icon: 'document-outline', remind: 60 },
  { key: 'emirates_id', label: 'Emirates ID', icon: 'id-card-outline', remind: 60 },
  { key: 'residence_permit', label: 'Residence permit', icon: 'home-outline', remind: 90 },
  { key: 'aadhaar', label: 'Aadhaar', icon: 'finger-print-outline', remind: 30 },
  { key: 'pan', label: 'PAN card', icon: 'card-outline', remind: 30 },
  { key: 'driving_license', label: 'Driving licence', icon: 'car-outline', remind: 60 },
  { key: 'vehicle_registration', label: 'Vehicle registration', icon: 'car-sport-outline', remind: 30 },
  { key: 'health_card', label: 'Health card', icon: 'medkit-outline', remind: 30 },
  { key: 'insurance_policy', label: 'Insurance policy', icon: 'shield-checkmark-outline', remind: 30 },
  { key: 'other', label: 'Other document', icon: 'folder-outline', remind: 30 },
];

export function documentTypeInfo(type: DocumentType) {
  return DOCUMENT_TYPES.find((d) => d.key === type) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

const CARD_REMIND_DEFAULT = 5;

function status(date: Date, remindOn: Date, on: Date): ActionStatus {
  if (diffDays(date, on) < 0) return 'overdue';
  if (diffDays(remindOn, on) <= 0) return 'due';
  return 'upcoming';
}

/** Next unpaid instalment: payments cover the nearest instalment, otherwise everything before `from` is assumed paid. */
export function nextEmiDate(plan: EmiPlan, from: Date): Date | null {
  const dates = instalmentDates(plan);
  if (plan.lastPaid) {
    const paid = parseDate(plan.lastPaid);
    const covered = dates.find((d) => diffDays(d, addDays(paid, -20)) >= 0);
    if (!covered) return null;
    return dates.find((d) => diffDays(d, covered) > 0) ?? null;
  }
  return dates.find((d) => diffDays(d, from) >= 0) ?? null;
}

/**
 * Everything the family needs to do in the current spending cycle: card bills, other bills,
 * EMIs and document renewals. Items outside the cycle are included once their reminder date is reached.
 */
export function generateActions(data: AppData, on: Date = new Date()): ActionItem[] {
  const sd = data.settings.cycleStartDay ?? 1;
  const { start, end } = cycleBounds(currentCycleKey(on, sd), sd);
  const inScope = (date: Date, remindOn: Date) => diffDays(date, end) <= 0 || diffDays(remindOn, on) <= 0;
  const out: ActionItem[] = [];
  const name = (id?: string) => data.accounts.find((a) => a.id === id)?.name;

  // Credit card bills
  const balances = computeBalances(data.accounts, data.transactions);
  for (const card of data.accounts) {
    if (card.archived || !isCreditCardConfigured(card)) continue;
    const info = cardCycleInfo(card, data.transactions, balances[card.id] ?? 0, on, data.emis);
    if (info.amountDue <= 0) continue;
    const remindOn = addDays(info.dueDate, -(card.remindDaysBefore ?? CARD_REMIND_DEFAULT));
    if (!inScope(info.dueDate, remindOn)) continue;
    out.push({
      id: `card-${card.id}`,
      kind: 'card',
      title: `Pay ${card.name} bill`,
      subtitle: 'Pay the full amount to avoid interest',
      date: info.dueDate,
      remindOn,
      amount: info.amountDue,
      status: status(info.dueDate, remindOn, on),
      icon: 'card',
      accountId: card.id,
    });
  }

  // Bills (mobile, internet, utilities, taxes, fines…)
  for (const bill of data.bills) {
    const t = billTypeInfo(bill.type);
    if (bill.lastPaid && diffDays(parseDate(bill.lastPaid), start) >= 0 && diffDays(parseDate(bill.lastPaid), on) <= 0) {
      out.push({ id: `bill-done-${bill.id}`, kind: 'bill', title: bill.name, subtitle: `Paid ${toISODate(parseDate(bill.lastPaid))}`, date: parseDate(bill.lastPaid), remindOn: parseDate(bill.lastPaid), amount: bill.amount, status: 'done', icon: t.icon, billId: bill.id });
    }
    const due = nextBillDate(bill, on, start);
    if (!due) continue;
    const remindOn = addDays(due, -bill.remindDaysBefore);
    if (!inScope(due, remindOn)) continue;
    // Logged as an expense with the same name but not marked paid → treat as paid.
    if (!bill.lastPaid && billPaidRecently(bill, data.transactions, on) && diffDays(due, addDays(on, 10)) <= 0) continue;
    out.push({
      id: `bill-${bill.id}-${toISODate(due)}`,
      kind: 'bill',
      title: bill.name,
      subtitle: [t.label, bill.reference].filter(Boolean).join(' · '),
      date: due,
      remindOn,
      amount: bill.amount,
      status: status(due, remindOn, on),
      icon: t.icon,
      billId: bill.id,
    });
  }

  // EMIs (card EMIs created from a purchase are already part of the card bill)
  for (const plan of data.emis) {
    if (plan.kind === 'card_emi' && plan.transactionId) continue;
    if (plan.lastPaid && diffDays(parseDate(plan.lastPaid), start) >= 0 && diffDays(parseDate(plan.lastPaid), on) <= 0) {
      out.push({ id: `emi-done-${plan.id}`, kind: 'emi', title: `${plan.name} EMI`, subtitle: `Paid ${plan.lastPaid}`, date: parseDate(plan.lastPaid), remindOn: parseDate(plan.lastPaid), amount: plan.monthlyAmount, status: 'done', icon: 'calendar-number-outline', emiId: plan.id });
    }
    const due = nextEmiDate(plan, start);
    if (!due) continue;
    const remindOn = addDays(due, -plan.remindDaysBefore);
    if (!inScope(due, remindOn)) continue;
    const idx = instalmentDates(plan).findIndex((d) => diffDays(d, due) === 0);
    out.push({
      id: `emi-${plan.id}-${toISODate(due)}`,
      kind: 'emi',
      title: `${plan.name} EMI`,
      subtitle: `Instalment ${idx + 1} of ${plan.totalMonths}${plan.accountId ? ` · ${name(plan.accountId)}` : ''}`,
      date: due,
      remindOn,
      amount: plan.monthlyAmount,
      status: status(due, remindOn, on),
      icon: 'calendar-number-outline',
      emiId: plan.id,
    });
  }

  // Document renewals
  for (const doc of data.documents) {
    if (!doc.expiryDate) continue;
    const exp = parseDate(doc.expiryDate);
    const remindOn = addDays(exp, -doc.remindDaysBefore);
    if (!inScope(exp, remindOn)) continue;
    const member = data.members.find((m) => m.id === doc.memberId)?.name;
    const days = diffDays(exp, on);
    out.push({
      id: `doc-${doc.id}`,
      kind: 'document',
      title: `Renew ${doc.name}${member ? ` (${member})` : ''}`,
      subtitle: days < 0 ? `Expired ${-days} days ago` : `Expires in ${days} days`,
      date: exp,
      remindOn,
      status: days < 0 ? 'overdue' : status(exp, remindOn, on),
      icon: documentTypeInfo(doc.type).icon,
      documentId: doc.id,
    });
  }

  const order: Record<ActionStatus, number> = { overdue: 0, due: 1, upcoming: 2, done: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || a.date.getTime() - b.date.getTime());
}

export function pendingCount(actions: ActionItem[]): number {
  return actions.filter((a) => a.status === 'overdue' || a.status === 'due').length;
}

export interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  date: Date;
}

/** Reminder notifications for the next `days` days: one on the reminder day and one on the due day. */
export function upcomingReminders(data: AppData, on: Date = new Date(), days = 90, money: (n: number) => string = String): ScheduledReminder[] {
  const until = addDays(on, days);
  const out: ScheduledReminder[] = [];
  const push = (id: string, what: string, due: Date, remind: number, amount?: number) => {
    const amt = amount ? ` – ${money(amount)}` : '';
    const remindOn = addDays(due, -remind);
    if (remind > 0 && diffDays(remindOn, on) > 0) {
      out.push({ id: `${id}-r`, title: `${what} due in ${remind} day${remind === 1 ? '' : 's'}`, body: `Due on ${toISODate(due)}${amt}`, date: remindOn });
    }
    if (diffDays(due, on) > 0) out.push({ id: `${id}-d`, title: `${what} is due today`, body: `Pay today${amt} to avoid late fees.`, date: due });
  };
  for (const bill of data.bills) {
    const occ = bill.frequency === 'once' ? (bill.lastPaid ? [] : [parseDate(bill.dueDate)]) : billOccurrences(bill, until).filter((d) => diffDays(d, on) > 0);
    const next = nextBillDate(bill, on);
    for (const d of occ.slice(0, 3)) if (!next || diffDays(d, next) >= 0) push(`bill-${bill.id}-${toISODate(d)}`, bill.name, d, bill.remindDaysBefore, bill.amount);
  }
  for (const plan of data.emis) {
    if (plan.kind === 'card_emi' && plan.transactionId) continue;
    for (const d of instalmentDates(plan).filter((x) => diffDays(x, on) > 0 && diffDays(x, until) <= 0).slice(0, 3)) {
      push(`emi-${plan.id}-${toISODate(d)}`, `${plan.name} EMI`, d, plan.remindDaysBefore, plan.monthlyAmount);
    }
  }
  const balances = computeBalances(data.accounts, data.transactions);
  for (const card of data.accounts) {
    if (card.archived || !isCreditCardConfigured(card)) continue;
    const info = cardCycleInfo(card, data.transactions, balances[card.id] ?? 0, on, data.emis);
    if (info.amountDue > 0) push(`card-${card.id}-${toISODate(info.dueDate)}`, `${card.name} bill`, info.dueDate, card.remindDaysBefore ?? CARD_REMIND_DEFAULT, info.amountDue);
  }
  for (const doc of data.documents) {
    if (!doc.expiryDate) continue;
    const exp = parseDate(doc.expiryDate);
    const remindOn = addDays(exp, -doc.remindDaysBefore);
    if (diffDays(remindOn, on) > 0 && diffDays(remindOn, until) <= 0) {
      out.push({ id: `doc-${doc.id}-r`, title: `${doc.name} expires in ${doc.remindDaysBefore} days`, body: `Expiry date ${doc.expiryDate}. Start the renewal now.`, date: remindOn });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export { firstOccurrenceFrom };
export type { Bill };
