import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildDemoData } from '../logic/demo';
import { encryptedStorage } from '../services/secureStorage';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../logic/defaults';
import { mergeTransactions } from '../logic/familySync';
import { PEOPLE_ACCOUNT_ID } from '../logic/money2';
import { uid } from '../logic/money';
import type {
  Account,
  AppData,
  Bill,
  Budget,
  Category,
  DocumentRecord,
  EmiPlan,
  FamilyGroup,
  GoogleAccount,
  Goal,
  Member,
  Settings,
  Transaction,
} from '../logic/types';

type New<T> = Omit<T, 'id' | 'createdAt'>;

/** Lists with plain add/edit/delete, handled by saveItem / deleteItem. */
export type ListKey = 'events' | 'policies' | 'vehicles' | 'claims' | 'vault' | 'challenges' | 'goals';

const TRASH_DAYS = 30;

interface Actions {
  addAccount: (a: New<Account>) => string;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (t: New<Transaction>) => string;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  /** Moves to the recycle bin (restorable for 30 days). */
  deleteTransaction: (id: string) => void;
  restoreTransaction: (id: string) => void;
  /** Creates the hidden "Lent & borrowed" account on first use. */
  ensurePeopleAccount: () => void;
  purgeTrash: (id?: string) => void;
  /** Saves (adds or updates by id) a record in one of the simple lists. */
  saveItem: <K extends ListKey>(key: K, item: Omit<AppData[K][number], 'id'> & { id?: string }) => string;
  deleteItem: (key: ListKey, id: string) => void;
  addCategory: (c: Omit<Category, 'id' | 'custom'>) => string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  setBudget: (b: Budget) => void;
  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addMember: (m: Omit<Member, 'id'>) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  saveBill: (b: Omit<Bill, 'id'> & { id?: string }) => void;
  deleteBill: (id: string) => void;
  saveEmi: (e: Omit<EmiPlan, 'id'> & { id?: string }) => string;
  deleteEmi: (id: string) => void;
  saveDocument: (d: Omit<DocumentRecord, 'id'> & { id?: string }) => void;
  deleteDocument: (id: string) => void;
  setGroup: (g: FamilyGroup | undefined, members?: Member[]) => void;
  importFamilySpends: (txns: Transaction[]) => number;
  setGoogle: (g: GoogleAccount | undefined) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (data: AppData) => void;
  loadDemo: () => void;
  resetAll: () => void;
}

export type Store = AppData & Actions;

const now = () => new Date().toISOString();

export const emptyData = (): AppData => ({
  accounts: [{ id: 'cash', name: 'Cash', type: 'cash', openingBalance: 0, createdAt: now() }],
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [],
  goals: [],
  members: [{ id: 'me', name: 'Me', relation: 'Self' }],
  bills: [],
  emis: [],
  documents: [],
  trash: [],
  events: [],
  policies: [],
  vehicles: [],
  claims: [],
  vault: [],
  challenges: [],
  settings: DEFAULT_SETTINGS,
});


const FAMILY_WALLET_ID = 'family-wallet';

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),

      addAccount: (a) => {
        const id = uid();
        set((s) => ({ accounts: [...s.accounts, { ...a, id, createdAt: now() }] }));
        return id;
      },
      updateAccount: (id, patch) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      // Accounts with history are archived (so reports stay correct); empty ones are removed.
      deleteAccount: (id) =>
        set((s) => {
          const used = s.transactions.some((t) => t.accountId === id || t.toAccountId === id);
          return used
            ? { accounts: s.accounts.map((a) => (a.id === id ? { ...a, archived: true } : a)) }
            : { accounts: s.accounts.filter((a) => a.id !== id) };
        }),

      addTransaction: (t) => {
        const id = uid();
        set((s) => {
          const txn: Transaction = { ...t, id, createdAt: now() };
          return { transactions: [txn, ...s.transactions] };
        });
        return id;
      },
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransaction: (id) =>
        set((s) => {
          const t = s.transactions.find((x) => x.id === id);
          if (!t) return {};
          return { transactions: s.transactions.filter((x) => x.id !== id), trash: [{ ...t, deletedAt: now() }, ...s.trash] };
        }),
      restoreTransaction: (id) =>
        set((s) => {
          const t = s.trash.find((x) => x.id === id);
          if (!t) return {};
          const { deletedAt: _d, ...rest } = t;
          return { trash: s.trash.filter((x) => x.id !== id), transactions: [rest, ...s.transactions] };
        }),
      // No id: removes items older than 30 days. With id: deletes that item for good.
      purgeTrash: (id) =>
        set((s) => {
          const cutoff = Date.now() - TRASH_DAYS * 86400000;
          const gone = s.trash.filter((t) => (id ? t.id === id : new Date(t.deletedAt ?? 0).getTime() < cutoff));
          if (!gone.length) return {};
          const ids = new Set(gone.map((t) => t.id));
          return { trash: s.trash.filter((t) => !ids.has(t.id)), emis: s.emis.filter((e) => !e.transactionId || !ids.has(e.transactionId)) };
        }),

      ensurePeopleAccount: () =>
        set((s) =>
          s.accounts.some((a) => a.id === PEOPLE_ACCOUNT_ID)
            ? {}
            : { accounts: [...s.accounts, { id: PEOPLE_ACCOUNT_ID, name: 'Lent & borrowed', type: 'people', openingBalance: 0, createdAt: now() }] },
        ),

      saveItem: (key, item) => {
        const id = item.id ?? uid();
        set((s) => {
          const list = s[key] as { id: string }[];
          const next = list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? { ...x, ...item, id } : x)) : [...list, { ...item, id }];
          return { [key]: next } as Partial<Store>;
        });
        return id;
      },
      deleteItem: (key, id) => set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<Store>),

      addCategory: (c) => {
        const id = `c_${uid()}`;
        set((s) => ({ categories: [...s.categories, { ...c, id, custom: true }] }));
        return id;
      },
      updateCategory: (id, patch) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      // Transactions of a deleted category move to "Other" (or "Other income").
      deleteCategory: (id) =>
        set((s) => {
          const cat = s.categories.find((c) => c.id === id);
          const fallback = cat?.kind === 'income' ? 'other_income' : 'other';
          return {
            categories: s.categories.filter((c) => c.id !== id),
            budgets: s.budgets.filter((b) => b.categoryId !== id),
            transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback } : t)),
          };
        }),

      setBudget: (b) =>
        set((s) => ({
          budgets: b.monthlyLimit > 0
            ? [...s.budgets.filter((x) => x.categoryId !== b.categoryId), b]
            : s.budgets.filter((x) => x.categoryId !== b.categoryId),
        })),


      addGoal: (g) => set((s) => ({ goals: [...s.goals, { ...g, id: uid() }] })),
      updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addMember: (m) => set((s) => ({ members: [...s.members, { ...m, id: uid() }] })),
      updateMember: (id, patch) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      deleteMember: (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

      saveBill: ({ id, ...b }) =>
        set((s) => (id ? { bills: s.bills.map((x) => (x.id === id ? { ...x, ...b } : x)) } : { bills: [...s.bills, { ...b, id: uid() }] })),
      deleteBill: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),

      saveEmi: ({ id, ...e }) => {
        const planId = id ?? uid();
        set((s) => ({
          emis: id ? s.emis.map((x) => (x.id === id ? { ...x, ...e } : x)) : [...s.emis, { ...e, id: planId }],
          transactions: e.transactionId
            ? s.transactions.map((t) => (t.id === e.transactionId ? { ...t, emiPlanId: planId } : t))
            : s.transactions,
        }));
        return planId;
      },
      deleteEmi: (id) =>
        set((s) => ({
          emis: s.emis.filter((e) => e.id !== id),
          transactions: s.transactions.map((t) => (t.emiPlanId === id ? { ...t, emiPlanId: undefined } : t)),
        })),

      saveDocument: ({ id, ...d }) =>
        set((s) => (id ? { documents: s.documents.map((x) => (x.id === id ? { ...x, ...d } : x)) } : { documents: [...s.documents, { ...d, id: uid() }] })),
      deleteDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      setGroup: (group, members) =>
        set((s) => {
          if (!members) return { group };
          // Keep local members, add/refresh the group's members by id.
          const map = new Map(s.members.map((m) => [m.id, m]));
          for (const m of members) map.set(m.id, { ...map.get(m.id), ...m });
          return { group, members: [...map.values()] };
        }),

      importFamilySpends: (incoming) => {
        const s = get();
        const accounts = s.accounts.some((a) => a.id === FAMILY_WALLET_ID)
          ? s.accounts
          : [...s.accounts, { id: FAMILY_WALLET_ID, name: 'Family members’ spends', type: 'other' as const, openingBalance: 0, createdAt: now() }];
        const { merged, added } = mergeTransactions(s.transactions, incoming, FAMILY_WALLET_ID);
        set({ accounts, transactions: merged, group: s.group ? { ...s.group, lastSync: now() } : s.group });
        return added;
      },

      setGoogle: (google) => set({ google }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      replaceAll: (data) => set(migrateData(data)),
      loadDemo: () => set({ ...buildDemoData(), group: undefined }),
      resetAll: () =>
        set((s) => ({ ...emptyData(), google: s.google, group: undefined, settings: { ...DEFAULT_SETTINGS, onboarded: true, premium: s.settings.premium } })),
    }),
    {
      name: 'familyfin-data',
      version: 3,
      storage: createJSONStorage(() => encryptedStorage),
      migrate: (persisted) => migrateData(persisted as Partial<AppData>) as unknown as Store,
    },
  ),
);

/** Upgrades data saved by older versions (and restored backups) to the current shape. */
export function migrateData(input: Partial<AppData>): AppData {
  // The price book (shop price comparison) was removed: drop its saved data.
  const { prices: _removed, ...raw } = input as Partial<AppData> & { prices?: unknown };
  const base = emptyData();
  const categories = [...(raw.categories ?? base.categories)];
  for (const c of DEFAULT_CATEGORIES) if (!categories.some((x) => x.id === c.id)) categories.push(c);
  const bills = (raw.bills ?? []).map((b) => {
    const old = b as Partial<Bill> & { dueDay?: number };
    if (old.dueDate) return b as Bill;
    const d = new Date();
    const day = String(Math.min(old.dueDay ?? 1, 28)).padStart(2, '0');
    return {
      id: old.id!,
      name: old.name ?? 'Bill',
      type: 'other',
      amount: old.amount ?? 0,
      frequency: 'monthly',
      dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`,
      remindDaysBefore: 3,
      categoryId: old.categoryId,
      accountId: old.accountId,
    } satisfies Bill;
  });
  return {
    ...base,
    ...raw,
    categories,
    bills,
    emis: raw.emis ?? [],
    documents: raw.documents ?? [],
    trash: raw.trash ?? [],
    events: raw.events ?? [],
    policies: raw.policies ?? [],
    vehicles: raw.vehicles ?? [],
    claims: raw.claims ?? [],
    vault: raw.vault ?? [],
    challenges: raw.challenges ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
  } as AppData;
}

/** Snapshot of the plain data (without actions) for the logic layer. */
export function selectData(s: Store): AppData {
  return {
    accounts: s.accounts,
    transactions: s.transactions,
    categories: s.categories,
    budgets: s.budgets,
    goals: s.goals,
    members: s.members,
    bills: s.bills,
    emis: s.emis,
    documents: s.documents,
    trash: s.trash,
    events: s.events,
    policies: s.policies,
    vehicles: s.vehicles,
    claims: s.claims,
    vault: s.vault,
    challenges: s.challenges,
    group: s.group,
    google: s.google,
    settings: s.settings,
  };
}
