import { expenses } from './analytics';
import { ACCOUNT_GROUP_OF } from './balances';
import type { Account, AppData, Insight, Transaction } from './types';

export type Region = 'IN' | 'GCC' | 'AE' | 'US' | 'UK' | 'EU' | 'CA' | 'AU' | 'SG' | 'SA_ASIA' | 'OTHER';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  region: Region;
  /** Approximate value of 1 INR in this currency – used only to price the premium plan. */
  perInr: number;
  decimals?: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', region: 'IN', perInr: 1 },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', locale: 'en-AE', region: 'AE', perInr: 0.0423 },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', locale: 'en-SA', region: 'GCC', perInr: 0.0432 },
  { code: 'QAR', symbol: 'QAR ', name: 'Qatari Riyal', locale: 'en-QA', region: 'GCC', perInr: 0.0419 },
  { code: 'KWD', symbol: 'KWD ', name: 'Kuwaiti Dinar', locale: 'en-KW', region: 'GCC', perInr: 0.00353, decimals: 3 },
  { code: 'BHD', symbol: 'BHD ', name: 'Bahraini Dinar', locale: 'en-BH', region: 'GCC', perInr: 0.00434, decimals: 3 },
  { code: 'OMR', symbol: 'OMR ', name: 'Omani Rial', locale: 'en-OM', region: 'GCC', perInr: 0.00443, decimals: 3 },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', region: 'US', perInr: 0.0115 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA', region: 'CA', perInr: 0.0159 },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', region: 'UK', perInr: 0.0088 },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', region: 'EU', perInr: 0.0099 },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc', locale: 'de-CH', region: 'EU', perInr: 0.0092 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', region: 'AU', perInr: 0.0176 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ', region: 'AU', perInr: 0.0195 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', region: 'SG', perInr: 0.0149 },
  { code: 'MYR', symbol: 'RM ', name: 'Malaysian Ringgit', locale: 'en-MY', region: 'SG', perInr: 0.051 },
  { code: 'PKR', symbol: 'Rs ', name: 'Pakistani Rupee', locale: 'en-PK', region: 'SA_ASIA', perInr: 3.2 },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'en-BD', region: 'SA_ASIA', perInr: 1.4 },
  { code: 'LKR', symbol: 'Rs ', name: 'Sri Lankan Rupee', locale: 'en-LK', region: 'SA_ASIA', perInr: 3.45 },
  { code: 'NPR', symbol: 'Rs ', name: 'Nepalese Rupee', locale: 'en-NP', region: 'SA_ASIA', perInr: 1.6 },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH', region: 'OTHER', perInr: 0.66 },
  { code: 'IDR', symbol: 'Rp ', name: 'Indonesian Rupiah', locale: 'id-ID', region: 'OTHER', perInr: 186 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', region: 'OTHER', perInr: 1.75 },
  { code: 'ZAR', symbol: 'R ', name: 'South African Rand', locale: 'en-ZA', region: 'OTHER', perInr: 0.205 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG', region: 'OTHER', perInr: 17.5 },
  { code: 'KES', symbol: 'KSh ', name: 'Kenyan Shilling', locale: 'en-KE', region: 'OTHER', perInr: 1.48 },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', locale: 'en-EG', region: 'OTHER', perInr: 0.56 },
];

export function currencyInfo(code: string | undefined): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/* ------------------------------ Premium pricing ------------------------------ */

export const PREMIUM_PRICE_INR = 2500;
/** Free plan: up to 3 accounts in each of these categories. */
export const FREE_PER_CATEGORY = 3;
export type LimitCategory = 'savings' | 'credit' | 'investment' | 'other';
export const LIMIT_CATEGORIES: { key: LimitCategory; label: string }[] = [
  { key: 'savings', label: 'savings & cash accounts' },
  { key: 'credit', label: 'credit cards' },
  { key: 'investment', label: 'investments & gold' },
  { key: 'other', label: 'loans, property & other' },
];

export function limitCategoryOf(type: Account['type']): LimitCategory {
  const g = ACCOUNT_GROUP_OF[type];
  return g === 'savings' || g === 'credit' || g === 'investment' ? g : 'other';
}

/** Accounts counted in a category. Archived accounts, debit cards linked to a bank and the lend/borrow ledger don't count. */
export function limitUsage(accounts: Account[], cat: LimitCategory): number {
  return accounts.filter((a) => !a.archived && a.type !== 'people' && !(a.type === 'debit_card' && a.linkedBankId) && limitCategoryOf(a.type) === cat).length;
}

export function accountLimitReached(accounts: Account[], type: Account['type'], premium: boolean): boolean {
  return !premium && limitUsage(accounts, limitCategoryOf(type)) >= FREE_PER_CATEGORY;
}

export function limitLabel(type: Account['type']): string {
  return LIMIT_CATEGORIES.find((c) => c.key === limitCategoryOf(type))!.label;
}

/** Rounds a converted price to a "shop" price, e.g. 28.75 → 28.99, 105.7 → 109, 4,650 → 4,699. */
export function nicePrice(v: number): number {
  if (v < 100) return Math.ceil(v) - 0.01;
  if (v < 1000) return Math.round(v / 10) * 10 - 1;
  const step = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / step) * step - 1;
}

export function premiumPrice(code: string): { amount: number; label: string } {
  const c = currencyInfo(code);
  const amount = c.code === 'INR' ? PREMIUM_PRICE_INR : nicePrice(PREMIUM_PRICE_INR * c.perInr);
  const decimals = amount % 1 === 0 ? 0 : 2;
  return { amount, label: `${c.symbol}${amount.toLocaleString(c.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}` };
}

/* ------------------------------ Regional tips ------------------------------ */

interface Tip {
  regions: Region[];
  /** Shown when the family spends in this category this cycle; omitted = general tip. */
  categoryId?: string;
  title: string;
  detail: string;
}

const GULF: Region[] = ['AE', 'GCC'];

const TIPS: Tip[] = [
  // India
  { regions: ['IN'], categoryId: 'health', title: 'Try Jan Aushadhi generic medicines', detail: 'Pradhan Mantri Bhartiya Janaushadhi Kendras sell generic medicines that are often 50–90% cheaper than branded ones.' },
  { regions: ['IN'], categoryId: 'transport', title: 'Get the 1% fuel surcharge waived', detail: 'Fuel co-branded and many other credit cards waive the 1% fuel surcharge and add reward points – use one for every fill-up.' },
  { regions: ['IN'], categoryId: 'telecom', title: 'Switch to an annual mobile plan', detail: 'Annual prepaid plans usually cost less per month than 28-day packs, and cut the number of recharges from 13 to 1.' },
  { regions: ['IN'], categoryId: 'groceries', title: 'Compare quick-commerce with your kirana', detail: '10-minute delivery apps often charge more plus fees. Buy monthly staples in bulk and use apps only for urgent items.' },
  { regions: ['IN'], categoryId: 'utilities', title: 'Pay utility bills through BBPS on UPI', detail: 'Bharat BillPay on UPI apps keeps receipts in one place and often has cashback offers. Choose 5-star BEE rated appliances when replacing.' },
  { regions: ['IN'], title: 'Use your tax-saving limits', detail: 'Under the old tax regime, PPF, ELSS and EPF count toward Section 80C (up to ₹1.5 lakh) and NPS gets an extra ₹50,000 under 80CCD(1B). Compare both regimes every year.' },
  // UAE + Gulf
  { regions: ['AE'], categoryId: 'transport', title: 'Fuel prices change every month', detail: 'UAE fuel prices are announced at the end of each month. If a hike is announced, fill the tank before the 1st.' },
  { regions: ['AE'], categoryId: 'utilities', title: 'Cut the summer AC bill', detail: 'Cooling is the biggest part of summer electricity bills. Keep the AC at 24°C or above and service it before summer.' },
  { regions: GULF, categoryId: 'groceries', title: 'Plan big grocery buys around promotions', detail: 'Hypermarkets run deep promotions before Ramadan, Eid and on weekends. Stock up on staples then and use loyalty programmes.' },
  { regions: GULF, categoryId: 'dining', title: 'Dining out often? Use a BOGO membership', detail: 'Buy-one-get-one dining and entertainment memberships pay for themselves in a few meals if the family eats out weekly.' },
  { regions: GULF, title: 'Compare remittance rates before sending money home', detail: 'Exchange houses and bank apps differ in both rate and fee. Compare the amount received, not just the fee, and send when the rate is good.' },
  { regions: GULF, title: "Don't count on gratuity as your savings", detail: 'End-of-service gratuity is not a savings plan. Build your own emergency fund of at least 6 months of expenses.' },
  // US
  { regions: ['US'], title: 'Get the full 401(k) match', detail: 'Contribute at least enough to get your employer’s full 401(k) match – it is an instant 50–100% return on that money.' },
  { regions: ['US'], title: 'Move your emergency fund to a high-yield account', detail: 'High-yield savings accounts pay far more than a checking account, and the money stays easy to reach.' },
  { regions: ['US', 'CA', 'UK', 'EU', 'AU'], categoryId: 'telecom', title: 'Renegotiate phone and internet yearly', detail: 'Call your provider at contract end or switch to a promo plan – loyal customers usually pay the most.' },
  { regions: ['US', 'CA', 'AU'], categoryId: 'groceries', title: 'Buy staples at warehouse clubs and store brands', detail: 'Store brands and bulk buys on non-perishables typically cost 20–30% less than name brands.' },
  // UK
  { regions: ['UK'], title: 'Use your ISA allowance', detail: 'You can put up to £20,000 a year into ISAs; interest and investment growth inside them are tax-free.' },
  { regions: ['UK'], categoryId: 'transport', title: 'Get a Railcard', detail: 'Railcards (e.g. Family & Friends, 16-25, Two Together) save a third on most rail fares.' },
  { regions: ['UK', 'EU'], categoryId: 'utilities', title: 'Check your energy tariff', detail: 'Compare tariffs when your fixed deal ends – staying on the default tariff often costs more.' },
  // EU
  { regions: ['EU'], categoryId: 'groceries', title: 'Shop at discount supermarkets', detail: 'Discount chains and own-label products are much cheaper for the same staples.' },
  // Canada / Australia / Singapore
  { regions: ['CA'], title: 'Use your TFSA room', detail: 'Growth in a Tax-Free Savings Account is tax-free; unused room carries forward.' },
  { regions: ['AU'], title: 'Consolidate your super', detail: 'Multiple superannuation accounts mean multiple fees. Combining them can save hundreds a year.' },
  { regions: ['SG'], title: 'Top up CPF for tax relief', detail: 'Cash top-ups to CPF (SA/RA or MediSave) can qualify for tax relief while growing retirement savings.' },
  // South Asia & others
  { regions: ['SA_ASIA', 'OTHER'], categoryId: 'groceries', title: 'Buy staples from wholesale markets', detail: 'Rice, flour, oil and pulses are usually much cheaper at wholesale markets bought monthly.' },
  { regions: ['SA_ASIA', 'OTHER', 'IN', 'AE', 'GCC'], categoryId: 'festivals', title: 'Plan festival spending early', detail: 'Set a festival budget 2–3 months ahead and save a little each month instead of paying by credit card at once.' },
  { regions: ['SA_ASIA', 'OTHER'], title: 'Save before you spend', detail: 'Move a fixed amount to savings on payday – what is left is your spending money.' },
];

/** Picks up to two tips for the family's region, preferring their biggest spending categories. */
export function regionalTips(data: AppData, cycleTxns: Transaction[]): Insight[] {
  const region = currencyInfo(data.settings.currencyCode).region;
  const matches = (t: Tip) => t.regions.includes(region) || (region === 'AE' && t.regions.includes('GCC'));
  const spend = new Map<string, number>();
  for (const t of expenses(cycleTxns)) spend.set(t.categoryId ?? 'other', (spend.get(t.categoryId ?? 'other') ?? 0) + t.amount);
  const tips = TIPS.filter(matches);
  const byCategory = tips
    .filter((t) => t.categoryId && (spend.get(t.categoryId) ?? 0) > 0)
    .sort((a, b) => (spend.get(b.categoryId!) ?? 0) - (spend.get(a.categoryId!) ?? 0));
  const general = tips.filter((t) => !t.categoryId);
  return [...byCategory.slice(0, 1), ...general.slice(0, 1), ...byCategory.slice(1)]
    .slice(0, 2)
    .map((t, i) => ({ id: `region-${region}-${i}`, severity: 'tip' as const, icon: 'globe-outline', title: t.title, detail: t.detail }));
}
