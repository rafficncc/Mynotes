import type { Category, Settings } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'cart-outline', color: '#2E7D32', kind: 'need' },
  { id: 'rent', name: 'Rent', icon: 'home-outline', color: '#5D4037', kind: 'need' },
  { id: 'emi', name: 'Loans & EMIs', icon: 'calendar-number-outline', color: '#4E342E', kind: 'need' },
  { id: 'utilities', name: 'Electricity, Water & Gas', icon: 'flash-outline', color: '#F9A825', kind: 'need' },
  { id: 'telecom', name: 'Mobile & Internet', icon: 'wifi-outline', color: '#3949AB', kind: 'need' },
  { id: 'govt', name: 'Taxes, Fines & Govt fees', icon: 'library-outline', color: '#37474F', kind: 'need' },
  { id: 'transport', name: 'Fuel & Transport', icon: 'car-outline', color: '#1565C0', kind: 'need' },
  { id: 'health', name: 'Health & Medicine', icon: 'medkit-outline', color: '#C62828', kind: 'need' },
  { id: 'education', name: 'Education & Fees', icon: 'school-outline', color: '#6A1B9A', kind: 'need' },
  { id: 'kids', name: 'Kids', icon: 'happy-outline', color: '#EC407A', kind: 'need' },
  { id: 'insurance', name: 'Insurance', icon: 'shield-checkmark-outline', color: '#00838F', kind: 'need' },
  { id: 'dining', name: 'Dining & Food delivery', icon: 'fast-food-outline', color: '#EF6C00', kind: 'want' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle-outline', color: '#AD1457', kind: 'want' },
  { id: 'entertainment', name: 'Entertainment', icon: 'film-outline', color: '#7B1FA2', kind: 'want' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'repeat-outline', color: '#455A64', kind: 'want' },
  { id: 'travel', name: 'Travel', icon: 'airplane-outline', color: '#0277BD', kind: 'want' },
  { id: 'festivals', name: 'Gifts & Festivals', icon: 'gift-outline', color: '#D84315', kind: 'want' },
  { id: 'personal', name: 'Personal care', icon: 'cut-outline', color: '#8D6E63', kind: 'want' },
  { id: 'remittance', name: 'Money sent home', icon: 'paper-plane-outline', color: '#0277BD', kind: 'need' },
  { id: 'investments', name: 'Savings & Investments', icon: 'trending-up-outline', color: '#2E7D32', kind: 'saving' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#757575', kind: 'want' },
  { id: 'salary', name: 'Salary', icon: 'briefcase-outline', color: '#2E7D32', kind: 'income' },
  { id: 'business', name: 'Business', icon: 'storefront-outline', color: '#00695C', kind: 'income' },
  { id: 'interest', name: 'Interest & Dividends', icon: 'stats-chart-outline', color: '#1B5E20', kind: 'income' },
  { id: 'cashback', name: 'Cashback & rewards', icon: 'gift-outline', color: '#43A047', kind: 'income' },
  { id: 'other_income', name: 'Other income', icon: 'add-circle-outline', color: '#388E3C', kind: 'income' },
];

export const DEFAULT_SETTINGS: Settings = {
  currencyCode: 'INR',
  currency: '₹',
  locale: 'en-IN',
  cycleStartDay: 1,
  premium: false,
  notificationsEnabled: true,
  payCardsInFull: true,
  onboarded: false,
};

/** Categories where lots of small spends usually add up ("latte factor"). */
export const SMALL_SPEND_CATEGORIES = ['dining', 'shopping', 'entertainment', 'personal', 'other'];
