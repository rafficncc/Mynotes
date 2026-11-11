import {
  expenses,
  inMonth,
  incomes,
  needsWantsSavings,
  projectMonthSpend,
  spendByCategory,
  spendByMerchant,
  sum,
  weekdayVsWeekend,
} from './analytics';
import { computeBalances, computeNetWorth } from './balances';
import { cardCycleInfo, isCreditCardConfigured, recommendCards } from './creditCard';
import { addDays, diffDays, formatShortDate, monthKey, parseDate, shiftMonthKey, toISODate } from './dates';
import { SMALL_SPEND_CATEGORIES } from './defaults';
import { formatMoney } from './money';
import { compareItems } from './priceBook';
import { billPaidRecently, detectSubscriptions, nextBillDate } from './recurring';
import type { AppData, Insight } from './types';

const SEVERITY_ORDER = { alert: 0, warning: 1, tip: 2, good: 3 } as const;

/**
 * Rule-based suggestion engine. Every rule looks at the family's own data and, where
 * possible, estimates how much could be saved per month by acting on it.
 */
export function generateInsights(data: AppData, on: Date = new Date()): Insight[] {
  const { transactions: txns, categories, accounts, settings } = data;
  const money = (n: number) => formatMoney(n, settings.currency, settings.locale);
  const out: Insight[] = [];
  const thisKey = toISODate(on).slice(0, 7);
  const lastKey = shiftMonthKey(thisKey, -1);
  const thisMonth = inMonth(txns, thisKey);
  const lastMonth = inMonth(txns, lastKey);
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? 'Other';
  const balances = computeBalances(accounts, txns);

  // 1. Budgets – overspent or on pace to overspend
  for (const b of data.budgets) {
    if (b.monthlyLimit <= 0) continue;
    const spent = sum(expenses(thisMonth).filter((t) => t.categoryId === b.categoryId));
    const projected = projectMonthSpend(spent, on);
    if (spent > b.monthlyLimit) {
      out.push({
        id: `budget-over-${b.categoryId}`,
        severity: 'alert',
        icon: 'alert-circle',
        title: `${catName(b.categoryId)} budget exceeded`,
        detail: `Spent ${money(spent)} of ${money(b.monthlyLimit)} this month. Pause non-essential ${catName(b.categoryId).toLowerCase()} spends till month end.`,
        monthlySaving: spent - b.monthlyLimit,
      });
    } else if (projected > b.monthlyLimit * 1.05 && on.getDate() >= 5) {
      out.push({
        id: `budget-pace-${b.categoryId}`,
        severity: 'warning',
        icon: 'speedometer',
        title: `${catName(b.categoryId)} on track to overshoot`,
        detail: `At this pace you'll spend about ${money(projected)} vs a ${money(b.monthlyLimit)} budget. Keep daily spend under ${money(Math.max(0, (b.monthlyLimit - spent) / Math.max(1, daysLeft(on))))}.`,
        monthlySaving: projected - b.monthlyLimit,
      });
    }
  }

  // 2. Category jumped vs the same days of last month (fair even mid-month, and fixed
  //    bills like rent paid on the same date cancel out). Savings going up is good, so skipped.
  const dayOfMonth = on.getDate();
  const lastToDate = lastMonth.filter((t) => Number(t.date.slice(8, 10)) <= dayOfMonth);
  const lastByCat = spendByCategory(lastToDate, categories);
  const thisByCat = spendByCategory(thisMonth, categories);
  const budgetFlagged = new Set(out.map((i) => i.id.replace(/^budget-(over|pace)-/, '')));
  for (const cur of thisByCat) {
    if (categories.find((c) => c.id === cur.key)?.kind === 'saving') continue;
    if (budgetFlagged.has(cur.key)) continue; // already covered by a budget alert
    const prev = lastByCat.find((p) => p.key === cur.key)?.value ?? 0;
    if (prev > 0 && cur.value > prev * 1.25 && cur.value - prev > 500 && dayOfMonth >= 7) {
      out.push({
        id: `jump-${cur.key}`,
        severity: 'warning',
        icon: 'trending-up',
        title: `${cur.label} up ${Math.round((cur.value / prev - 1) * 100)}%`,
        detail: `${money(cur.value)} so far this month vs ${money(prev)} by the same date last month.`,
        monthlySaving: cur.value - prev,
      });
    }
  }

  // 3. Latte factor – many small discretionary spends
  const recent = txns.filter((t) => t.type === 'expense' && diffDays(on, parseDate(t.date)) <= 30 && diffDays(on, parseDate(t.date)) >= 0);
  for (const cat of SMALL_SPEND_CATEGORIES) {
    const small = recent.filter((t) => t.categoryId === cat && t.amount <= 600);
    if (small.length >= 8) {
      const total = sum(small);
      out.push({
        id: `small-${cat}`,
        severity: 'tip',
        icon: 'cafe',
        title: `${small.length} small ${catName(cat).toLowerCase()} spends in 30 days`,
        detail: `They add up to ${money(total)} a month (${money(total * 12)} a year). Cutting half of them saves ${money(total / 2)} every month.`,
        monthlySaving: total / 2,
      });
    }
  }

  // 4. Cheaper shop for the same item (price book)
  for (const c of compareItems(data.prices, on).slice(0, 5)) {
    if (c.savingPerUnit <= 0 || c.cheapest.shop === c.usual.shop) continue;
    if (c.savingPerUnit / c.usual.price < 0.03) continue;
    const perMonth = (c.purchases90d / 3) * c.savingPerUnit;
    out.push({
      id: `shop-${c.item}`,
      severity: 'tip',
      icon: 'storefront',
      title: `Buy ${c.item} at ${c.cheapest.shop}`,
      detail: `${money(c.cheapest.price)} at ${c.cheapest.shop} vs ${money(c.usual.price)} at ${c.usual.shop} – save ${money(c.savingPerUnit)} per ${c.unit ?? 'unit'}${perMonth > 0 ? `, about ${money(perMonth)}/month at your usage` : ''}.`,
      monthlySaving: perMonth || undefined,
    });
  }

  // 5. Same category, a cheaper merchant the family already uses
  for (const cat of thisByCat.slice(0, 6)) {
    const catTxns = txns.filter((t) => t.type === 'expense' && t.categoryId === cat.key && diffDays(on, parseDate(t.date)) <= 90);
    const merchants = spendByMerchant(catTxns, 20).filter((m) => m.count >= 3);
    if (merchants.length < 2) continue;
    const withAvg = merchants.map((m) => ({ ...m, avg: m.total / m.count })).sort((a, b) => a.avg - b.avg);
    const cheap = withAvg[0];
    const top = [...withAvg].sort((a, b) => b.total - a.total)[0];
    if (top.merchant !== cheap.merchant && top.avg > cheap.avg * 1.2) {
      const saving = ((top.avg - cheap.avg) * top.count) / 3;
      out.push({
        id: `merchant-${cat.key}`,
        severity: 'tip',
        icon: 'swap-horizontal',
        title: `Try ${cheap.merchant} more for ${cat.label.toLowerCase()}`,
        detail: `Your average bill at ${top.merchant} is ${money(top.avg)} vs ${money(cheap.avg)} at ${cheap.merchant}. Shifting your ${top.merchant} visits could save ~${money(saving)}/month.`,
        monthlySaving: saving,
      });
    }
  }

  // 6. Subscriptions
  // Rent, fees, insurance and SIPs recur too, but they are not "subscriptions" to cancel.
  const notSubs = new Set(['rent', 'education', 'insurance', 'utilities']);
  const subs = detectSubscriptions(txns).filter((s) => {
    const kind = categories.find((c) => c.id === s.categoryId)?.kind;
    return kind !== 'saving' && !notSubs.has(s.categoryId ?? '');
  });
  if (subs.length > 0) {
    const total = subs.reduce((s, x) => s + x.amount, 0);
    out.push({
      id: 'subscriptions',
      severity: 'tip',
      icon: 'repeat',
      title: `${subs.length} recurring charge${subs.length > 1 ? 's' : ''} detected`,
      detail: `${subs.map((s) => `${s.merchant} (${money(s.amount)})`).join(', ')} – ${money(total)}/month. Cancel the ones nobody used last month, or switch to annual/family plans.`,
      monthlySaving: Math.round(total * 0.3),
    });
  }

  // 7. Weekend splurge
  const ww = weekdayVsWeekend(recent);
  if (ww.weekendAvg > ww.weekdayAvg * 1.8 && ww.weekendAvg - ww.weekdayAvg > 500) {
    out.push({
      id: 'weekend',
      severity: 'tip',
      icon: 'calendar',
      title: 'Weekends cost you much more',
      detail: `You spend ${money(ww.weekendAvg)} per weekend day vs ${money(ww.weekdayAvg)} on weekdays. Plan one free family outing (park, home movie night) each weekend.`,
      monthlySaving: (ww.weekendAvg - ww.weekdayAvg) * 2,
    });
  }

  // 8. Credit cards: dues, utilisation, float
  const cards = accounts.filter((a) => isCreditCardConfigured(a) && !a.archived);
  for (const card of cards) {
    const info = cardCycleInfo(card, txns, balances[card.id] ?? 0, on);
    if (info.amountDue > 0 && info.daysToDue < 0) {
      out.push({
        id: `card-overdue-${card.id}`,
        severity: 'alert',
        icon: 'warning',
        title: `${card.name} bill overdue`,
        detail: `${money(info.amountDue)} was due on ${formatShortDate(info.dueDate)}. Pay now to stop interest (~3.5%/month) and late fees.`,
      });
    } else if (info.amountDue > 0 && info.daysToDue <= 5) {
      out.push({
        id: `card-due-${card.id}`,
        severity: 'alert',
        icon: 'time',
        title: `${card.name}: pay ${money(info.amountDue)} in ${info.daysToDue} day${info.daysToDue === 1 ? '' : 's'}`,
        detail: `Due ${formatShortDate(info.dueDate)}. Always pay the full amount – minimum due attracts heavy interest.`,
      });
    }
    if (info.utilization !== null && info.utilization > 0.3) {
      out.push({
        id: `card-util-${card.id}`,
        severity: 'warning',
        icon: 'pie-chart',
        title: `${card.name} is ${Math.round(info.utilization * 100)}% used`,
        detail: 'Keeping utilisation under 30% protects your credit score. Spread spends across cards or pay part of it early.',
      });
    }
  }
  if (cards.length > 0) {
    const best = recommendCards(cards, balances, on)[0];
    if (best) {
      out.push({
        id: 'best-card-today',
        severity: 'good',
        icon: 'card',
        title: `Swipe ${best.account.name} today`,
        detail: `Purchases today get ${best.freeDays} interest-free days (due ${formatShortDate(best.dueDate)}).`,
      });
    }
    if (settings.payCardsInFull) {
      const nonCard = expenses(thisMonth).filter((t) => {
        const type = accounts.find((a) => a.id === t.accountId)?.type;
        const kind = categories.find((c) => c.id === t.categoryId)?.kind;
        // Rent, school fees and investments usually can't be paid by card.
        const cardable = kind !== 'saving' && t.categoryId !== 'rent' && t.categoryId !== 'education';
        return cardable && (type === 'debit_card' || type === 'bank' || type === 'wallet');
      });
      const amt = sum(nonCard.filter((t) => t.amount >= 1000));
      if (amt >= 5000) {
        out.push({
          id: 'float',
          severity: 'tip',
          icon: 'hourglass',
          title: 'Use your credit card for big planned spends',
          detail: `${money(amt)} of large payments went from bank/debit this month. Paying them by credit card (and clearing in full) keeps money in your account ~30-45 days longer and earns rewards.`,
        });
      }
    }
  }

  // 9. Upcoming bills
  for (const bill of data.bills) {
    const due = nextBillDate(bill, on);
    const days = diffDays(due, on);
    if (days <= 5 && !billPaidRecently(bill, txns, on)) {
      out.push({
        id: `bill-${bill.id}`,
        severity: days <= 1 ? 'alert' : 'warning',
        icon: 'receipt',
        title: `${bill.name} due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
        detail: `${money(bill.amount)} on ${formatShortDate(due)}. Set up autopay to never miss it.`,
      });
    }
  }

  // 10. 50/30/20 and savings rate (based on last full month, or this month if no history)
  const basis = lastMonth.length > 0 ? lastMonth : thisMonth;
  const income = sum(incomes(basis));
  if (income > 0) {
    const nws = needsWantsSavings(basis, categories);
    const spent = nws.needs + nws.wants;
    const savingsRate = (income - spent) / income;
    if (nws.wants / income > 0.3) {
      out.push({
        id: 'wants',
        severity: 'warning',
        icon: 'happy',
        title: `Wants are ${Math.round((nws.wants / income) * 100)}% of income`,
        detail: `The 50-30-20 rule suggests at most 30% (${money(income * 0.3)}). Trimming to that frees ${money(nws.wants - income * 0.3)} a month for savings.`,
        monthlySaving: nws.wants - income * 0.3,
      });
    }
    if (savingsRate >= 0.2) {
      out.push({
        id: 'savings-good',
        severity: 'good',
        icon: 'trophy',
        title: `Great! You saved ${Math.round(savingsRate * 100)}% of income`,
        detail: 'Move the surplus to a SIP / recurring deposit on salary day so it is not spent by accident.',
      });
    } else if (savingsRate < 0.1) {
      out.push({
        id: 'savings-low',
        severity: 'warning',
        icon: 'trending-down',
        title: `Savings rate only ${Math.max(0, Math.round(savingsRate * 100))}%`,
        detail: `Aim for 20% (${money(income * 0.2)}). "Pay yourself first" – auto-transfer savings on salary day.`,
      });
    }
  }

  // 11. Emergency fund
  const avgMonthly = average([1, 2, 3].map((i) => sum(expenses(inMonth(txns, shiftMonthKey(thisKey, -i))))).filter((x) => x > 0));
  const nw = computeNetWorth(accounts, balances);
  if (avgMonthly > 0 && nw.liquid < avgMonthly * 3) {
    out.push({
      id: 'emergency',
      severity: 'warning',
      icon: 'umbrella',
      title: 'Build a family emergency fund',
      detail: `Liquid money covers ${(nw.liquid / avgMonthly).toFixed(1)} months of expenses. Target at least 6 months (${money(avgMonthly * 6)}).`,
    });
  }

  // 12. Big cash spends are hard to track
  const cashTxns = expenses(thisMonth).filter((t) => accounts.find((a) => a.id === t.accountId)?.type === 'cash');
  const cashShare = sum(expenses(thisMonth)) > 0 ? sum(cashTxns) / sum(expenses(thisMonth)) : 0;
  if (cashShare > 0.35 && sum(cashTxns) > 3000) {
    out.push({
      id: 'cash',
      severity: 'tip',
      icon: 'cash',
      title: `${Math.round(cashShare * 100)}% of spending is in cash`,
      detail: 'Cash leaks easily. Pay by UPI/card where possible – it is tracked automatically and often earns cashback.',
    });
  }

  return out.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (b.monthlySaving ?? 0) - (a.monthlySaving ?? 0),
  );
}

function daysLeft(on: Date): number {
  const end = new Date(on.getFullYear(), on.getMonth() + 1, 0);
  return diffDays(end, on) + 1;
}

function average(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

export function totalPotentialSaving(insights: Insight[]): number {
  return insights.reduce((s, i) => s + Math.max(0, i.monthlySaving ?? 0), 0);
}

/** Counts consecutive days (ending today) without any "want" category spend. */
export function noSplurgeStreak(data: AppData, on: Date = new Date()): number {
  const wantIds = new Set(data.categories.filter((c) => c.kind === 'want').map((c) => c.id));
  const splurgeDays = new Set(
    data.transactions.filter((t) => t.type === 'expense' && wantIds.has(t.categoryId ?? 'other')).map((t) => t.date),
  );
  const first = data.transactions.reduce<string | null>((m, t) => (m === null || t.date < m ? t.date : m), null);
  if (!first) return 0;
  let streak = 0;
  let d = on;
  while (!splurgeDays.has(toISODate(d)) && diffDays(d, parseDate(first)) >= 0 && streak < 365) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

export interface HealthScore {
  score: number;
  label: string;
  parts: { name: string; score: number; max: number; hint: string }[];
}

/** 0–100 family financial health score. */
export function healthScore(data: AppData, on: Date = new Date()): HealthScore {
  const thisKey = monthKey(toISODate(on));
  const months = [1, 2, 3].map((i) => inMonth(data.transactions, shiftMonthKey(thisKey, -i)));
  const income = months.reduce((s, m) => s + sum(incomes(m)), 0);
  const spent = months.reduce((s, m) => s + sum(expenses(m).filter((t) => {
    const kind = data.categories.find((c) => c.id === t.categoryId)?.kind;
    return kind !== 'saving';
  })), 0);
  const parts: HealthScore['parts'] = [];

  // Savings rate (30)
  const rate = income > 0 ? (income - spent) / income : 0;
  parts.push({ name: 'Savings rate', score: clamp(Math.round((rate / 0.3) * 30), 0, 30), max: 30, hint: `${Math.round(rate * 100)}% of income saved (target 30%)` });

  // Budget discipline (20)
  const thisMonth = inMonth(data.transactions, thisKey);
  const budgets = data.budgets.filter((b) => b.monthlyLimit > 0);
  const within = budgets.filter((b) => projectMonthSpend(sum(expenses(thisMonth).filter((t) => t.categoryId === b.categoryId)), on) <= b.monthlyLimit).length;
  parts.push({
    name: 'Budget discipline',
    score: budgets.length ? Math.round((within / budgets.length) * 20) : 10,
    max: 20,
    hint: budgets.length ? `${within}/${budgets.length} budgets on track` : 'Set budgets to earn full points',
  });

  // Emergency fund (25)
  const balances = computeBalances(data.accounts, data.transactions);
  const nw = computeNetWorth(data.accounts, balances);
  const avgMonthly = spent / 3;
  const cover = avgMonthly > 0 ? nw.liquid / avgMonthly : nw.liquid > 0 ? 6 : 0;
  parts.push({ name: 'Emergency fund', score: clamp(Math.round((cover / 6) * 25), 0, 25), max: 25, hint: `${cover.toFixed(1)} months covered (target 6)` });

  // Credit health (25)
  const cards = data.accounts.filter((a) => a.type === 'credit_card' && !a.archived);
  let credit = 25;
  let creditHint = 'No credit card debt';
  for (const card of cards) {
    if (!isCreditCardConfigured(card)) continue;
    const info = cardCycleInfo(card, data.transactions, balances[card.id] ?? 0, on);
    if (info.amountDue > 0 && info.daysToDue < 0) { credit -= 15; creditHint = `${card.name} bill overdue`; }
    if (info.utilization !== null && info.utilization > 0.3) { credit -= 5; creditHint = `${card.name} utilisation above 30%`; }
  }
  parts.push({ name: 'Credit health', score: clamp(credit, 0, 25), max: 25, hint: creditHint });

  const score = parts.reduce((s, p) => s + p.score, 0);
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs care' : 'At risk';
  return { score, label, parts };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
