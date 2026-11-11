import type { Account, Transaction } from './types';

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

export interface NetWorth {
  assets: number;
  liabilities: number;
  net: number;
  liquid: number;
}

export function computeNetWorth(accounts: Account[], balances: Record<string, number>): NetWorth {
  let assets = 0;
  let liabilities = 0;
  let liquid = 0;
  for (const a of accounts) {
    if (a.archived) continue;
    if (a.type === 'debit_card' && a.linkedBankId) continue; // counted in the bank
    const b = balances[a.id] ?? 0;
    if (b >= 0) assets += b;
    else liabilities += -b;
    if ((a.type === 'cash' || a.type === 'bank' || a.type === 'wallet') && b > 0) liquid += b;
  }
  return { assets, liabilities, net: assets - liabilities, liquid };
}

export const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  cash: 'Cash',
  bank: 'Bank account',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  wallet: 'UPI / Wallet',
  other: 'Other',
};

export const ACCOUNT_TYPE_ICON: Record<Account['type'], string> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  debit_card: 'card-outline',
  credit_card: 'card',
  wallet: 'phone-portrait-outline',
  other: 'wallet-outline',
};
