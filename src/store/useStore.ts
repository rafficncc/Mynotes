import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildDemoData } from '../logic/demo';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../logic/defaults';
import { uid } from '../logic/money';
import type { Account, AppData, Bill, Budget, Goal, Member, PriceEntry, Settings, Transaction } from '../logic/types';

type New<T> = Omit<T, 'id' | 'createdAt'>;

interface Actions {
  addAccount: (a: New<Account>) => string;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (t: New<Transaction>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (b: Budget) => void;
  addPrice: (p: Omit<PriceEntry, 'id'>) => void;
  deletePrice: (id: string) => void;
  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addMember: (m: Omit<Member, 'id'>) => void;
  deleteMember: (id: string) => void;
  addBill: (b: Omit<Bill, 'id'>) => void;
  deleteBill: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
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
  prices: [],
  goals: [],
  members: [{ id: 'me', name: 'Me', relation: 'Self' }],
  bills: [],
  settings: DEFAULT_SETTINGS,
});

export const useStore = create<Store>()(
  persist(
    (set) => ({
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

      addTransaction: (t) =>
        set((s) => {
          const txn: Transaction = { ...t, id: uid(), createdAt: now() };
          const prices = [...s.prices];
          // Logging an item with a merchant automatically builds the price book.
          if (txn.type === 'expense' && txn.item && txn.merchant && txn.quantity && txn.quantity > 0) {
            prices.push({ id: uid(), item: txn.item, shop: txn.merchant, price: Math.round((txn.amount / txn.quantity) * 100) / 100, date: txn.date });
          }
          return { transactions: [txn, ...s.transactions], prices };
        }),
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      setBudget: (b) =>
        set((s) => ({
          budgets: b.monthlyLimit > 0
            ? [...s.budgets.filter((x) => x.categoryId !== b.categoryId), b]
            : s.budgets.filter((x) => x.categoryId !== b.categoryId),
        })),

      addPrice: (p) => set((s) => ({ prices: [...s.prices, { ...p, id: uid() }] })),
      deletePrice: (id) => set((s) => ({ prices: s.prices.filter((p) => p.id !== id) })),

      addGoal: (g) => set((s) => ({ goals: [...s.goals, { ...g, id: uid() }] })),
      updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addMember: (m) => set((s) => ({ members: [...s.members, { ...m, id: uid() }] })),
      deleteMember: (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

      addBill: (b) => set((s) => ({ bills: [...s.bills, { ...b, id: uid() }] })),
      deleteBill: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      loadDemo: () => set(buildDemoData()),
      resetAll: () => set({ ...emptyData(), settings: { ...DEFAULT_SETTINGS, onboarded: true } }),
    }),
    {
      name: 'familyfin-data',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Snapshot of the plain data (without actions) for the logic layer. */
export function selectData(s: Store): AppData {
  return {
    accounts: s.accounts,
    transactions: s.transactions,
    categories: s.categories,
    budgets: s.budgets,
    prices: s.prices,
    goals: s.goals,
    members: s.members,
    bills: s.bills,
    settings: s.settings,
  };
}
