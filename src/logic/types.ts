export type AccountType =
  | 'cash'
  | 'bank'
  | 'debit_card'
  | 'credit_card'
  | 'wallet'
  | 'deposit'
  | 'investment'
  | 'loan'
  | 'property'
  | 'other';

/** How accounts are grouped on screen and in net worth. */
export type AccountGroup = 'savings' | 'investment' | 'credit' | 'loan' | 'real_estate' | 'other';

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
  /** Loans: yearly interest rate in % */
  interestRate?: number;
  /** Credit cards: remind this many days before the due date. */
  remindDaysBefore?: number;
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
  /** Set when this purchase was converted to an EMI plan (credit card EMI). */
  emiPlanId?: string;
  createdAt: string;
}

export type CategoryKind = 'need' | 'want' | 'saving' | 'income';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  /** Created by the user (can be edited/deleted). */
  custom?: boolean;
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
  /** Spending allowance for this member per cycle. */
  budget?: number;
}

export type BillType =
  | 'mobile'
  | 'internet'
  | 'electricity'
  | 'water'
  | 'gas'
  | 'rent'
  | 'school'
  | 'insurance'
  | 'tax'
  | 'fine'
  | 'government'
  | 'subscription'
  | 'other';

export type Frequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'once';

export interface Bill {
  id: string;
  name: string;
  type: BillType;
  amount: number;
  frequency: Frequency;
  /** First / next due date (YYYY-MM-DD). Repeating bills recur from this date. */
  dueDate: string;
  remindDaysBefore: number;
  categoryId?: string;
  accountId?: string;
  /** Date the most recent occurrence was paid. */
  lastPaid?: string;
  /** Mobile number, consumer number, tax reference… */
  reference?: string;
}

export type EmiKind = 'card_emi' | 'loan_emi' | 'other';

export interface EmiPlan {
  id: string;
  name: string;
  kind: EmiKind;
  /** Card, loan or bank account the EMI is charged to / paid from. */
  accountId?: string;
  /** Purchase converted to EMI (card EMIs created from a transaction). */
  transactionId?: string;
  principal: number;
  monthlyAmount: number;
  totalMonths: number;
  /** Date of the first instalment */
  startDate: string;
  interestRate?: number;
  remindDaysBefore: number;
  /** Date the most recent instalment was paid (loan / other EMIs). */
  lastPaid?: string;
}

export type DocumentType =
  | 'passport'
  | 'visa'
  | 'emirates_id'
  | 'aadhaar'
  | 'pan'
  | 'driving_license'
  | 'vehicle_registration'
  | 'residence_permit'
  | 'health_card'
  | 'insurance_policy'
  | 'other';

export interface DocumentRecord {
  id: string;
  type: DocumentType;
  name: string;
  memberId?: string;
  number?: string;
  expiryDate?: string;
  remindDaysBefore: number;
  notes?: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  /** Short code other members type to join. */
  code: string;
  /** True on the phone that created the group. */
  isAdmin: boolean;
  /** Last time this phone merged updates from others. */
  lastSync?: string;
}

export interface GoogleAccount {
  email: string;
  name?: string;
  photo?: string;
  accessToken?: string;
  /** epoch ms */
  expiresAt?: number;
  lastBackup?: string;
}

export interface Settings {
  /** ISO currency code, e.g. INR, AED, USD */
  currencyCode: string;
  /** Display symbol */
  currency: string;
  locale: string;
  /** Day of month the spending cycle starts (e.g. salary day). 1 = calendar month. */
  cycleStartDay: number;
  /** Which family member uses this phone – new transactions default to them. */
  currentMemberId?: string;
  premium: boolean;
  notificationsEnabled: boolean;
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
  emis: EmiPlan[];
  documents: DocumentRecord[];
  group?: FamilyGroup;
  google?: GoogleAccount;
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
