export type AccountType =
  | 'cash'
  | 'bank'
  | 'debit_card'
  | 'credit_card'
  | 'wallet'
  | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Starting balance. For credit cards this is negative when there is already an outstanding amount. */
  openingBalance: number;
  createdAt: string;
  archived?: boolean;
  /** Debit cards can be linked to a bank account – spends then reduce the bank balance. */
  linkedBankId?: string;
  /** Credit card only */
  creditLimit?: number;
  /** Day of month the statement is generated (1-31). */
  billingDay?: number;
  /** Day of month the payment is due (1-31). */
  dueDay?: number;
  /** Optional reward rate in % – used by the smart card picker as a tie breaker. */
  rewardRate?: number;
}

export type TxnType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  /** Local date, YYYY-MM-DD */
  date: string;
  accountId: string;
  /** Destination account for transfers (e.g. paying a credit card bill from a bank). */
  toAccountId?: string;
  categoryId?: string;
  merchant?: string;
  memberId?: string;
  note?: string;
  /** Optional item bought – feeds the price book used for "cheaper shop" suggestions. */
  item?: string;
  quantity?: number;
  createdAt: string;
}

export type CategoryKind = 'need' | 'want' | 'saving' | 'income';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

export interface Budget {
  categoryId: string;
  monthlyLimit: number;
}

export interface PriceEntry {
  id: string;
  item: string;
  shop: string;
  /** Price per unit */
  price: number;
  unit?: string;
  date: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string;
}

export interface Member {
  id: string;
  name: string;
  relation: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  categoryId?: string;
  accountId?: string;
}

export interface Settings {
  currency: string;
  locale: string;
  /** If the user always pays card bills in full, using credit cards is "free float" and the app can recommend it. */
  payCardsInFull: boolean;
  onboarded: boolean;
}

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  prices: PriceEntry[];
  goals: Goal[];
  members: Member[];
  bills: Bill[];
  settings: Settings;
}

export type InsightSeverity = 'alert' | 'warning' | 'tip' | 'good';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** Estimated monthly saving if the user acts on the suggestion. */
  monthlySaving?: number;
  icon: string;
}
