import { computeBalances } from './balances';
import { cardCycleInfo, dueDateFor } from './creditCard';
import { addDays, clampedDate, diffDays, toISODate } from './dates';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';
import type { AppData, Transaction } from './types';

/** Deterministic pseudo random so the demo looks the same each time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Builds ~4 months of realistic family data so new users can explore every feature. */
export function buildDemoData(on: Date = new Date()): AppData {
  const r = rng(42);
  const now = toISODate(on);
  const txns: Transaction[] = [];
  let n = 0;
  const add = (t: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (t.date > now) return;
    txns.push({ ...t, id: `demo${n++}`, createdAt: t.date });
  };

  for (let m = 3; m >= 0; m--) {
    const y = on.getFullYear();
    const mi = on.getMonth() - m;
    const d = (day: number) => toISODate(clampedDate(y, mi, day));
    add({ type: 'income', amount: 85000, date: d(1), accountId: 'bank', categoryId: 'salary', merchant: 'Employer' });
    add({ type: 'expense', amount: 18000, date: d(3), accountId: 'bank', categoryId: 'rent', merchant: 'House rent' });
    add({ type: 'expense', amount: 5000, date: d(5), accountId: 'bank', categoryId: 'investments', merchant: 'SIP – Index fund' });
    add({ type: 'expense', amount: 1800 + Math.round(r() * 600), date: d(8), accountId: 'upi', categoryId: 'utilities', merchant: 'Electricity board' });
    add({ type: 'expense', amount: 999, date: d(6), accountId: 'upi', categoryId: 'telecom', merchant: 'Home broadband' });
    add({ type: 'transfer', amount: 12500, date: d(5), accountId: 'bank', toAccountId: 'loan', note: 'Car loan EMI' });
    add({ type: 'expense', amount: 649, date: d(10), accountId: 'hdfc', categoryId: 'subscriptions', merchant: 'StreamPlus OTT' });
    add({ type: 'expense', amount: 399, date: d(12), accountId: 'sbi', categoryId: 'telecom', merchant: 'Mobile postpaid' });
    add({ type: 'expense', amount: 999, date: d(15), accountId: 'hdfc', categoryId: 'subscriptions', merchant: 'FitZone Gym' });
    add({ type: 'expense', amount: 4500, date: d(10), accountId: 'bank', categoryId: 'education', merchant: 'School fees', memberId: 'kid1' });
    add({ type: 'transfer', amount: 6000, date: d(2), accountId: 'bank', toAccountId: 'cash', note: 'ATM withdrawal' });
    add({ type: 'transfer', amount: 15000, date: d(2), accountId: 'bank', toAccountId: 'upi', note: 'Wallet top-up' });

    for (let day = 1; day <= 28; day++) {
      const date = d(day);
      const weekday = clampedDate(y, mi, day).getDay();
      const weekend = weekday === 0 || weekday === 6;
      if (r() < 0.35) {
        const shop = r() < 0.6 ? 'FreshMart' : 'Kirana Corner';
        add({ type: 'expense', amount: Math.round(300 + r() * 1400), date, accountId: r() < 0.5 ? 'upi' : 'hdfc', categoryId: 'groceries', merchant: shop });
      }
      if (r() < (weekend ? 0.7 : 0.25)) {
        const place = r() < 0.6 ? 'Zesty Food Delivery' : 'Cafe Aroma';
        add({ type: 'expense', amount: Math.round(150 + r() * (weekend ? 1200 : 400)), date, accountId: r() < 0.5 ? 'upi' : 'sbi', categoryId: 'dining', merchant: place });
      }
      if (r() < 0.12) add({ type: 'expense', amount: Math.round(500 + r() * 1500), date, accountId: 'hdfc', categoryId: 'transport', merchant: 'City Fuels' });
      if (r() < 0.08) add({ type: 'expense', amount: Math.round(800 + r() * 3500), date, accountId: r() < 0.5 ? 'sbi' : 'debit', categoryId: 'shopping', merchant: r() < 0.5 ? 'MegaMall' : 'ShopKart Online', memberId: r() < 0.5 ? 'wife' : undefined });
      if (r() < 0.15) add({ type: 'expense', amount: Math.round(40 + r() * 260), date, accountId: 'cash', categoryId: 'other', merchant: 'Tea & snacks' });
      if (r() < 0.05) add({ type: 'expense', amount: Math.round(200 + r() * 1200), date, accountId: 'cash', categoryId: 'health', merchant: 'Apollo Pharmacy' });
      if (r() < 0.06) add({ type: 'expense', amount: Math.round(300 + r() * 900), date, accountId: 'upi', categoryId: 'kids', merchant: 'Toy Town', memberId: 'kid1' });
    }
  }

  // A 36,000 TV bought on the Rewards Card ~50 days ago and converted to a 6-month no-cost EMI.
  const tvDate = toISODate(addDays(on, -50));
  txns.push({ id: 'demo-tv', type: 'expense', amount: 36000, date: tvDate, accountId: 'hdfc', categoryId: 'shopping', merchant: 'ElectroWorld', note: 'Smart TV', emiPlanId: 'emi-tv', createdAt: tvDate });
  const emis: AppData['emis'] = [
    { id: 'emi-tv', name: 'Smart TV', kind: 'card_emi', accountId: 'hdfc', transactionId: 'demo-tv', principal: 36000, monthlyAmount: 6000, totalMonths: 6, startDate: toISODate(addDays(on, -40)), interestRate: 0, remindDaysBefore: 3 },
    { id: 'emi-car', name: 'Car loan', kind: 'loan_emi', accountId: 'loan', principal: 700000, monthlyAmount: 12500, totalMonths: 60, startDate: toISODate(clampedDate(on.getFullYear(), on.getMonth() - 14, 5)), interestRate: 9, remindDaysBefore: 3, lastPaid: toISODate(clampedDate(on.getFullYear(), on.getMonth() - (on.getDate() >= 5 ? 0 : 1), 5)) },
  ];
  const inMonthDay = (day: number, monthsAgo = 3) => toISODate(clampedDate(on.getFullYear(), on.getMonth() - monthsAgo, day));

  const accounts: AppData['accounts'] = [
    { id: 'cash', name: 'Cash wallet', type: 'cash', openingBalance: 2000, createdAt: now },
    { id: 'bank', name: 'Salary account', type: 'bank', openingBalance: 60000, createdAt: now },
    { id: 'debit', name: 'Salary debit card', type: 'debit_card', openingBalance: 0, linkedBankId: 'bank', createdAt: now },
    { id: 'upi', name: 'UPI wallet', type: 'wallet', openingBalance: 15000, createdAt: now },
    { id: 'hdfc', name: 'Rewards Card', type: 'credit_card', openingBalance: 0, creditLimit: 150000, billingDay: 5, dueDay: 25, rewardRate: 1.5, createdAt: now },
    { id: 'sbi', name: 'Shopping Card', type: 'credit_card', openingBalance: 0, creditLimit: 60000, billingDay: 18, dueDay: 7, rewardRate: 1, createdAt: now },
    { id: 'mf', name: 'Mutual funds (SIP)', type: 'investment', openingBalance: 240000, createdAt: now },
    { id: 'fd', name: 'Fixed deposit', type: 'deposit', openingBalance: 100000, createdAt: now },
    { id: 'loan', name: 'Car loan', type: 'loan', openingBalance: -650000, interestRate: 9, createdAt: now },
    { id: 'flat', name: 'Apartment', type: 'property', openingBalance: 4500000, createdAt: now },
  ];

  // A disciplined family: every card bill is paid in full from the bank 2 days before it is due.
  for (const card of accounts.filter((a) => a.type === 'credit_card')) {
    for (let m = 4; m >= 0; m--) {
      const statement = clampedDate(on.getFullYear(), on.getMonth() - m, card.billingDay!);
      const payOn = addDays(dueDateFor(statement, card.dueDay!), -2);
      if (diffDays(payOn, on) > 0) continue;
      const bal = computeBalances(accounts, txns);
      const info = cardCycleInfo(card, txns, bal[card.id] ?? 0, payOn, emis);
      if (info.amountDue > 0) {
        add({ type: 'transfer', amount: info.amountDue, date: toISODate(payOn), accountId: 'bank', toAccountId: card.id, note: `${card.name} bill` });
      }
    }
  }

  const priceDays = [80, 60, 45, 30, 20, 10, 3];
  const prices = priceDays.flatMap((ago, i) => {
    const date = toISODate(addDays(on, -ago));
    return [
      { id: `p${i}a`, item: 'Milk', unit: 'litre', shop: 'FreshMart', price: 60, date },
      { id: `p${i}b`, item: 'Rice (Sona Masoori)', unit: 'kg', shop: 'FreshMart', price: 68, date },
      { id: `p${i}c`, item: 'Cooking oil', unit: 'litre', shop: 'FreshMart', price: 165, date },
    ];
  });
  prices.push(
    { id: 'pk1', item: 'Milk', unit: 'litre', shop: 'Kirana Corner', price: 54, date: toISODate(addDays(on, -12)) },
    { id: 'pk2', item: 'Rice (Sona Masoori)', unit: 'kg', shop: 'Wholesale Bazaar', price: 56, date: toISODate(addDays(on, -15)) },
    { id: 'pk3', item: 'Cooking oil', unit: 'litre', shop: 'Wholesale Bazaar', price: 148, date: toISODate(addDays(on, -15)) },
  );

  return {
    accounts,
    transactions: txns,
    categories: DEFAULT_CATEGORIES,
    budgets: [
      { categoryId: 'groceries', monthlyLimit: 9000 },
      { categoryId: 'dining', monthlyLimit: 5000 },
      { categoryId: 'shopping', monthlyLimit: 4000 },
      { categoryId: 'transport', monthlyLimit: 4000 },
    ],
    prices,
    goals: [
      { id: 'g1', name: 'Emergency fund', target: 300000, saved: 85000 },
      { id: 'g2', name: 'Family vacation', target: 80000, saved: 22000, deadline: toISODate(addDays(on, 150)) },
    ],
    members: [
      { id: 'me', name: 'Me', relation: 'Self' },
      { id: 'wife', name: 'Priya', relation: 'Spouse', budget: 8000 },
      { id: 'kid1', name: 'Aarav', relation: 'Son', budget: 3000 },
    ],
    bills: [
      { id: 'b1', name: 'Electricity board', type: 'electricity', amount: 2000, frequency: 'monthly', dueDate: inMonthDay(8), remindDaysBefore: 3, categoryId: 'utilities' },
      { id: 'b2', name: 'House rent', type: 'rent', amount: 18000, frequency: 'monthly', dueDate: inMonthDay(3), remindDaysBefore: 2, categoryId: 'rent' },
      { id: 'b4', name: 'Mobile postpaid', type: 'mobile', amount: 399, frequency: 'monthly', dueDate: inMonthDay(12), remindDaysBefore: 2, reference: '98xxxxxx21', categoryId: 'telecom' },
      { id: 'b5', name: 'Home broadband', type: 'internet', amount: 999, frequency: 'monthly', dueDate: inMonthDay(6), remindDaysBefore: 2, categoryId: 'telecom' },
      { id: 'b3', name: 'Term insurance', type: 'insurance', amount: 18000, frequency: 'yearly', dueDate: toISODate(addDays(on, 9)), remindDaysBefore: 15, categoryId: 'insurance' },
      { id: 'b6', name: 'Property tax', type: 'tax', amount: 6500, frequency: 'half_yearly', dueDate: toISODate(addDays(on, 24)), remindDaysBefore: 10, categoryId: 'govt' },
      { id: 'b7', name: 'Traffic challan', type: 'fine', amount: 500, frequency: 'once', dueDate: toISODate(addDays(on, -2)), remindDaysBefore: 3, reference: 'Signal jump', categoryId: 'govt' },
    ],
    emis,
    documents: [
      { id: 'd1', type: 'passport', name: 'Passport', memberId: 'me', number: 'Z1234567', expiryDate: toISODate(addDays(on, 120)), remindDaysBefore: 180 },
      { id: 'd2', type: 'driving_license', name: 'Driving licence', memberId: 'me', expiryDate: toISODate(addDays(on, 400)), remindDaysBefore: 60 },
      { id: 'd3', type: 'visa', name: 'Visa', memberId: 'wife', expiryDate: toISODate(addDays(on, 25)), remindDaysBefore: 30, notes: 'Family trip' },
      { id: 'd4', type: 'aadhaar', name: 'Aadhaar', memberId: 'kid1', remindDaysBefore: 30, notes: 'Biometric update due at age 15' },
      { id: 'd5', type: 'vehicle_registration', name: 'Car insurance & PUC', expiryDate: toISODate(addDays(on, 11)), remindDaysBefore: 15 },
    ],
    settings: { ...DEFAULT_SETTINGS, onboarded: true, currentMemberId: 'me' },
  };
}
