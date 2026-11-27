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
  | 'gold'
  | 'people'
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
  /** Deposits: maturity date and amount */
  maturityDate?: string;
  maturityAmount?: number;
  /** Investments: monthly SIP amount and debit day */
  sipAmount?: number;
  sipDay?: number;
  /** Last SIP debit recorded automatically (YYYY-MM-DD). */
  sipLast?: string;
  /** Gold / jewellery weight in grams */
  goldGrams?: number;
  /** Credit cards: reward points balance and value of one point */
  rewardPoints?: number;
  pointValue?: number;
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
  /** Optional item bought (e.g. for the warranty reminder). */
  item?: string;
  quantity?: number;
  /** Set when this purchase was converted to an EMI plan (credit card EMI). */
  emiPlanId?: string;
  /** Lend / borrow / split: the other person (transfers to or from the "People" account). */
  person?: string;
  /** Photo of the bill, saved in the app's private folder. */
  photoUri?: string;
  /** Warranty end date for things bought (reminder before it ends). */
  warrantyUntil?: string;
  /** Paid in another currency: original amount and the rate used (amount = foreign × rate). For remittances: amount received at home. */
  fx?: { currency: string; amount: number; rate: number };
  /** Remittance / transfer fee included in this record. */
  fee?: number;
  /** Event or trip this spend belongs to. */
  eventId?: string;
  /** Vehicle log: which vehicle, odometer reading and litres filled. */
  vehicleId?: string;
  odometer?: number;
  litres?: number;
  /** Set when moved to the recycle bin. */
  deletedAt?: string;
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

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string;
  /** Automatic monthly contribution */
  autoAmount?: number;
  autoDay?: number;
  fromAccountId?: string;
  toAccountId?: string;
  /** Last date an automatic contribution was added (YYYY-MM-DD). */
  lastAuto?: string;
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

export interface EventBudget {
  id: string;
  name: string;
  kind: 'trip' | 'wedding' | 'festival' | 'move' | 'party' | 'other';
  budget: number;
  startDate: string;
  endDate?: string;
  closed?: boolean;
}

export type PolicyType = 'life' | 'term' | 'health' | 'vehicle' | 'home' | 'travel' | 'other';

export interface InsurancePolicy {
  id: string;
  type: PolicyType;
  name: string;
  insurer?: string;
  policyNo?: string;
  memberId?: string;
  sumAssured?: number;
  premium: number;
  frequency: Frequency;
  /** Next premium due date */
  nextDue: string;
  remindDaysBefore: number;
  /** Policy end / renewal date */
  renewalDate?: string;
  nominee?: string;
  lastPaid?: string;
  notes?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  regNo?: string;
  insuranceExpiry?: string;
  pucExpiry?: string;
  nextServiceDate?: string;
  nextServiceKm?: number;
  remindDaysBefore: number;
}

export type ClaimStatus = 'to_submit' | 'submitted' | 'approved' | 'paid' | 'rejected';

export interface MedicalClaim {
  id: string;
  title: string;
  memberId?: string;
  policyId?: string;
  amount: number;
  date: string;
  submittedOn?: string;
  status: ClaimStatus;
  approvedAmount?: number;
  notes?: string;
  /** Income transaction recorded when the claim was paid out. */
  paidTxnId?: string;
}

/** Money Vault category key (see VAULT_CATEGORIES). Older entries used 'contact' | 'nominee' | 'account' | 'instruction' | 'other'. */
export type VaultSection = string;

export interface VaultEntry {
  id: string;
  section: VaultSection;
  /** Name / institution, e.g. "SBI savings", "LIC term plan" */
  title: string;
  /** Free note */
  detail: string;
  holder?: string;
  nominee?: string;
  /** Where to find the papers, app or key */
  where?: string;
  /** Branch, agent or HR phone */
  contact?: string;
  value?: number;
  /** Category-specific fields, e.g. { lockerNo: '214' } */
  extra?: Record<string, string>;
  /** Item from the app (account, policy, document…) this entry adds details to. */
  linkedId?: string;
}

export type ChallengeType = 'no_spend_weekend' | 'week52' | 'no_category_week' | 'save_target';

export interface Challenge {
  id: string;
  type: ChallengeType;
  startDate: string;
  /** 52-week: amount for week 1; save_target: amount to save */
  amount?: number;
  categoryId?: string;
  /** 52-week: week numbers ticked off */
  done?: number[];
  memberId?: string;
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
  lockEnabled?: boolean;
  /** Lock again after the app was in the background this many minutes (0 = immediately). */
  lockAfterMinutes?: number;
  useBiometrics?: boolean;
  hideAmounts?: boolean;
  weeklySummary?: boolean;
  /** Tips the user has dismissed (tutorial cards). */
  seenTips?: string[];
  /** If the user always pays card bills in full, using credit cards is "free float" and the app can recommend it. */
  payCardsInFull: boolean;
  onboarded: boolean;
  /** How Premium was bought: a yearly plan is re-checked with the store, lifetime is kept. */
  premiumPlan?: 'lifetime' | 'yearly';
  /** The family's own Money Vault topics; a new group name makes a new group. */
  vaultCustom?: { key: string; group: string; label: string }[];
  /** Money Vault categories the family doesn't have. */
  vaultNA?: string[];
  /** When the family file was last shared, and with whom. */
  vaultShared?: { at: string; with: string };
  /** Hour of day (0–23) for bill and document reminders. Default 9. */
  reminderHour?: number;
  /** Free-plan monthly counters for scans and voice entries. */
  usage?: { month: string; scans: number; voice: number };
}

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  members: Member[];
  bills: Bill[];
  emis: EmiPlan[];
  documents: DocumentRecord[];
  trash: Transaction[];
  events: EventBudget[];
  policies: InsurancePolicy[];
  vehicles: Vehicle[];
  claims: MedicalClaim[];
  vault: VaultEntry[];
  challenges: Challenge[];
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
