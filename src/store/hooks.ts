import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { computeBalances } from '../logic/balances';
import { formatCompact, formatMoney } from '../logic/money';
import { selectData, useStore } from './useStore';

/** All persisted data (no actions), re-rendering only when data changes. */
export function useAppData() {
  return useStore(useShallow(selectData));
}

export function useMoney() {
  const settings = useStore((s) => s.settings);
  return useMemo(
    () => ({
      money: (n: number) => formatMoney(n, settings.currency, settings.locale),
      compact: (n: number) => formatCompact(n, settings.currency),
    }),
    [settings.currency, settings.locale],
  );
}

export function useBalances() {
  const accounts = useStore((s) => s.accounts);
  const txns = useStore((s) => s.transactions);
  return useMemo(() => computeBalances(accounts, txns), [accounts, txns]);
}
