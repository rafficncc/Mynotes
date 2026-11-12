import { addDays, clampedDate, diffDays, parseDate, toISODate } from './dates';
import { cardEmiCharges } from './emi';
import type { Account, EmiPlan, Transaction } from './types';

/**
 * Credit card billing maths.
 *
 * A purchase made on or before the billing (statement) day lands on that month's statement;
 * a purchase made after it lands on next month's statement. The payment due date is the first
 * occurrence of the due day after the statement date. The number of days between the purchase
 * and the due date is the interest-free period you get for that purchase.
 */

export function statementDateFor(purchase: Date, billingDay: number): Date {
  const thisMonth = clampedDate(purchase.getFullYear(), purchase.getMonth(), billingDay);
  if (diffDays(purchase, thisMonth) <= 0) return thisMonth;
  return clampedDate(purchase.getFullYear(), purchase.getMonth() + 1, billingDay);
}

export function dueDateFor(statement: Date, dueDay: number): Date {
  const sameMonth = clampedDate(statement.getFullYear(), statement.getMonth(), dueDay);
  if (diffDays(sameMonth, statement) > 0) return sameMonth;
  return clampedDate(statement.getFullYear(), statement.getMonth() + 1, dueDay);
}

export function interestFreeDays(purchase: Date, billingDay: number, dueDay: number): number {
  return diffDays(dueDateFor(statementDateFor(purchase, billingDay), dueDay), purchase);
}

/** Most recent statement date strictly before or on `on`. */
export function lastStatementDate(on: Date, billingDay: number): Date {
  const thisMonth = clampedDate(on.getFullYear(), on.getMonth(), billingDay);
  if (diffDays(on, thisMonth) >= 0) return thisMonth;
  return clampedDate(on.getFullYear(), on.getMonth() - 1, billingDay);
}

export function isCreditCardConfigured(a: Account): boolean {
  return a.type === 'credit_card' && !!a.billingDay && !!a.dueDay;
}

export interface CardCycleInfo {
  account: Account;
  lastStatement: Date;
  nextStatement: Date;
  dueDate: Date;
  daysToDue: number;
  /** Amount billed on the last statement still unpaid. */
  amountDue: number;
  /** Spends after the last statement – go on the next bill. */
  unbilled: number;
  outstanding: number;
  available: number | null;
  utilization: number | null;
  /** Interest-free days if you swipe this card today. */
  freeDaysToday: number;
}

function cardMovements(card: Account, txns: Transaction[], emis: EmiPlan[], on: Date) {
  // Purchases converted to EMI are billed as monthly instalments instead of in full.
  const charges: { date: Date; amount: number }[] = cardEmiCharges(emis, card.id, on);
  const payments: { date: Date; amount: number }[] = [];
  for (const t of txns) {
    if (t.type === 'expense' && t.accountId === card.id && !t.emiPlanId) charges.push({ date: parseDate(t.date), amount: t.amount });
    if (t.type === 'income' && t.accountId === card.id) payments.push({ date: parseDate(t.date), amount: t.amount }); // refunds / cashback
    if (t.type === 'transfer' && t.toAccountId === card.id) payments.push({ date: parseDate(t.date), amount: t.amount });
    if (t.type === 'transfer' && t.accountId === card.id) charges.push({ date: parseDate(t.date), amount: t.amount });
  }
  return { charges, payments };
}

export function cardCycleInfo(card: Account, txns: Transaction[], balance: number, on: Date, emis: EmiPlan[] = []): CardCycleInfo {
  const billingDay = card.billingDay ?? 1;
  const dueDay = card.dueDay ?? 20;
  const last = lastStatementDate(on, billingDay);
  const next = clampedDate(last.getFullYear(), last.getMonth() + 1, billingDay);
  const { charges, payments } = cardMovements(card, txns, emis, on);

  // Everything outstanding at the last statement (including older unpaid amounts and opening balance)
  const opening = card.openingBalance < 0 ? -card.openingBalance : 0;
  const chargedUpToLast = charges.filter((c) => diffDays(c.date, last) <= 0).reduce((s, c) => s + c.amount, 0);
  const paidUpToLast = payments.filter((p) => diffDays(p.date, last) <= 0).reduce((s, p) => s + p.amount, 0);
  const billed = Math.max(0, opening + chargedUpToLast - paidUpToLast);
  const paidSince = payments.filter((p) => diffDays(p.date, last) > 0).reduce((s, p) => s + p.amount, 0);
  const amountDue = Math.max(0, billed - paidSince);
  const unbilled = charges.filter((c) => diffDays(c.date, last) > 0).reduce((s, c) => s + c.amount, 0);

  // While the last bill is unpaid its due date matters (negative daysToDue = overdue);
  // once it is cleared, the next cycle's due date is the relevant one.
  const dueDate = amountDue > 0 ? dueDateFor(last, dueDay) : dueDateFor(next, dueDay);

  const outstanding = Math.max(0, -balance);
  const available = card.creditLimit ? card.creditLimit - outstanding : null;
  const utilization = card.creditLimit ? outstanding / card.creditLimit : null;

  return {
    account: card,
    lastStatement: last,
    nextStatement: next,
    dueDate,
    daysToDue: diffDays(dueDate, on),
    amountDue,
    unbilled,
    outstanding,
    available,
    utilization,
    freeDaysToday: interestFreeDays(on, billingDay, dueDay),
  };
}

export interface CardRecommendation {
  account: Account;
  freeDays: number;
  dueDate: Date;
  statementDate: Date;
  available: number | null;
  reason: string;
}

/**
 * Ranks configured credit cards for a purchase: most interest-free days first, cards without
 * enough limit are dropped, reward rate breaks ties, and high utilisation is penalised.
 */
export function recommendCards(
  cards: Account[],
  balances: Record<string, number>,
  purchaseDate: Date,
  amount = 0,
): CardRecommendation[] {
  const recs: (CardRecommendation & { score: number })[] = [];
  for (const card of cards) {
    if (!isCreditCardConfigured(card) || card.archived) continue;
    const outstanding = Math.max(0, -(balances[card.id] ?? 0));
    const available = card.creditLimit ? card.creditLimit - outstanding : null;
    if (available !== null && amount > 0 && available < amount) continue;
    const statementDate = statementDateFor(purchaseDate, card.billingDay!);
    const dueDate = dueDateFor(statementDate, card.dueDay!);
    const freeDays = diffDays(dueDate, purchaseDate);
    const utilAfter = card.creditLimit ? (outstanding + amount) / card.creditLimit : 0;
    const score = freeDays + (card.rewardRate ?? 0) * 2 - (utilAfter > 0.3 ? 10 : 0);
    const parts = [`${freeDays} interest-free days`, `pay by ${toISODate(dueDate)}`];
    if (card.rewardRate) parts.push(`${card.rewardRate}% rewards`);
    if (utilAfter > 0.3) parts.push('utilisation would exceed 30%');
    recs.push({ account: card, freeDays, dueDate, statementDate, available, reason: parts.join(' · '), score });
  }
  recs.sort((a, b) => b.score - a.score);
  return recs.map(({ score: _s, ...r }) => r);
}

/**
 * The first 5 days after a billing date give the longest interest-free period ("golden window").
 * Returns the current window if we are inside it, otherwise the next one.
 */
export function goldenWindow(card: Account, on: Date): { start: Date; end: Date } | null {
  if (!isCreditCardConfigured(card)) return null;
  const last = lastStatementDate(on, card.billingDay!);
  let start = addDays(last, 1);
  if (diffDays(on, addDays(start, 4)) > 0) {
    start = addDays(clampedDate(last.getFullYear(), last.getMonth() + 1, card.billingDay!), 1);
  }
  return { start, end: addDays(start, 4) };
}
