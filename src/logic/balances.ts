import type { Account, AccountGroup, AccountType, InvestKind, Transaction } from './types';

/**
 * Debit cards linked to a bank account do not hold money themselves – their spends
 * hit the linked bank. This resolves the account whose balance actually moves.
 */
export function ledgerAccountId(accounts: Account[], accountId: string): string {
  const acc = accounts.find((a) => a.id === accountId);
  if (acc?.type === 'debit_card' && acc.linkedBankId) return acc.linkedBankId;
  return accountId;
}

export function computeBalances(accounts: Account[], txns: Transaction[]): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const a of accounts) bal[a.id] = a.openingBalance;
  const add = (id: string, amt: number) => {
    const target = ledgerAccountId(accounts, id);
    bal[target] = (bal[target] ?? 0) + amt;
  };
  for (const t of txns) {
    if (t.type === 'expense') add(t.accountId, -t.amount);
    else if (t.type === 'income') add(t.accountId, t.amount);
    else if (t.type === 'transfer' && t.toAccountId) {
      add(t.accountId, -t.amount);
      add(t.toAccountId, t.amount);
    }
  }
  return bal;
}

/** Types whose balance is money you owe (stored as a negative balance). */
export const LIABILITY_TYPES: AccountType[] = ['credit_card', 'loan'];
/** Accounts you can pay from or receive into (not investments, loans or property). */
export const SPENDABLE_TYPES: AccountType[] = ['cash', 'bank', 'debit_card', 'credit_card', 'wallet', 'other'];
/** Money available to spend today. */
export const LIQUID_TYPES: AccountType[] = ['cash', 'bank', 'wallet'];
/** Money in accounts marked as the emergency fund. */
export const emergencyFund = (accounts: Account[], balances: Record<string, number>) =>
  accounts.filter((a) => a.emergency && !a.archived).reduce((s, a) => s + Math.max(0, balances[a.id] ?? 0), 0);

/** Accounts offered for paying: spendable types, never the emergency fund. */
export const canPayFrom = (a: Account) => SPENDABLE_TYPES.includes(a.type) && !a.emergency;

export interface NetWorth {
  assets: number;
  liabilities: number;
  net: number;
  liquid: number;
  byGroup: Record<AccountGroup, number>;
}

/**
 * `people` (from personBalances) splits the lend & borrow ledger: money others owe you is an asset,
 * money you owe them a liability. Without it the ledger counts as one net amount.
 */
export function computeNetWorth(accounts: Account[], balances: Record<string, number>, people?: { balance: number }[]): NetWorth {
  let assets = 0;
  let liabilities = 0;
  let liquid = 0;
  const byGroup: Record<AccountGroup, number> = { savings: 0, investment: 0, credit: 0, loan: 0, real_estate: 0, other: 0 };
  for (const a of accounts) {
    if (a.archived) continue;
    if (a.type === 'debit_card' && a.linkedBankId) continue; // counted in the bank
    if (a.type === 'people' && people) continue;
    const b = balances[a.id] ?? 0;
    if (b >= 0) assets += b;
    else liabilities += -b;
    if (LIQUID_TYPES.includes(a.type) && !a.emergency && b > 0) liquid += b;
    byGroup[ACCOUNT_GROUP_OF[a.type]] += b;
  }
  for (const p of people ?? []) {
    if (p.balance > 0) assets += p.balance;
    else liabilities += -p.balance;
    byGroup.other += p.balance;
  }
  return { assets, liabilities, net: assets - liabilities, liquid, byGroup };
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank account',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  wallet: 'UPI / Wallet',
  deposit: 'Fixed / recurring deposit',
  investment: 'Stocks, funds & gold',
  loan: 'Loan',
  property: 'Property / real estate',
  gold: 'Gold & jewellery',
  people: 'Lent & borrowed',
  other: 'Other',
};

export const ACCOUNT_TYPE_ICON: Record<AccountType, string> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  debit_card: 'card-outline',
  credit_card: 'card',
  wallet: 'phone-portrait-outline',
  deposit: 'lock-closed-outline',
  investment: 'trending-up-outline',
  loan: 'document-text-outline',
  property: 'home-outline',
  gold: 'diamond-outline',
  people: 'people-outline',
  other: 'wallet-outline',
};

export const ACCOUNT_GROUP_OF: Record<AccountType, AccountGroup> = {
  cash: 'savings',
  bank: 'savings',
  debit_card: 'savings',
  wallet: 'savings',
  deposit: 'investment',
  investment: 'investment',
  credit_card: 'credit',
  loan: 'loan',
  property: 'real_estate',
  gold: 'investment',
  people: 'other',
  other: 'other',
};

export const ACCOUNT_GROUPS: { key: AccountGroup; label: string; icon: string; types: AccountType[] }[] = [
  { key: 'savings', label: 'Savings & cash', icon: 'wallet-outline', types: ['bank', 'cash', 'wallet', 'debit_card'] },
  { key: 'investment', label: 'Investments', icon: 'trending-up-outline', types: ['investment', 'deposit', 'gold'] },
  { key: 'credit', label: 'Credit cards', icon: 'card-outline', types: ['credit_card'] },
  { key: 'loan', label: 'Loans', icon: 'document-text-outline', types: ['loan'] },
  { key: 'real_estate', label: 'Real estate', icon: 'home-outline', types: ['property'] },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', types: ['other', 'people'] },
];

export function isLiability(type: AccountType): boolean {
  return LIABILITY_TYPES.includes(type);
}

/** Investment choices shown in the account form: deposits and gold are their own account types, the rest are 'investment' with a kind. */
export const INVEST_OPTIONS: { key: string; label: string; icon: string; type: AccountType; kind?: InvestKind }[] = [
  { key: 'mutual_fund', label: 'Mutual funds & SIPs', icon: 'pie-chart-outline', type: 'investment', kind: 'mutual_fund' },
  { key: 'stocks', label: 'Stocks & shares', icon: 'stats-chart-outline', type: 'investment', kind: 'stocks' },
  { key: 'deposit', label: 'Fixed / recurring deposit', icon: 'lock-closed-outline', type: 'deposit' },
  { key: 'bonds', label: 'Bonds', icon: 'ribbon-outline', type: 'investment', kind: 'bonds' },
  { key: 'gold', label: 'Gold & jewellery', icon: 'diamond-outline', type: 'gold' },
  { key: 'ppf', label: 'PPF', icon: 'shield-checkmark-outline', type: 'investment', kind: 'ppf' },
  { key: 'epf', label: 'EPF / PF / gratuity', icon: 'briefcase-outline', type: 'investment', kind: 'epf' },
  { key: 'nps', label: 'NPS / pension', icon: 'umbrella-outline', type: 'investment', kind: 'nps' },
  { key: 'crypto', label: 'Crypto', icon: 'logo-bitcoin', type: 'investment', kind: 'crypto' },
  { key: 'other', label: 'Other investment', icon: 'briefcase-outline', type: 'investment', kind: 'other' },
];

/** The investment option an account belongs to (older 'investment' accounts with no kind are mutual funds). */
export const investOption = (a: Pick<Account, 'type' | 'investKind'>) =>
  INVEST_OPTIONS.find((o) => (a.type === 'investment' ? o.kind === (a.investKind ?? 'mutual_fund') : o.type === a.type));
