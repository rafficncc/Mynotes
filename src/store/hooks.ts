import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { computeBalances } from '../logic/balances';
import { currentCycleKey, cycleBounds, cycleLabel, cycleProgress } from '../logic/dates';
import { formatCompact, formatMoney } from '../logic/money';
import { currencyInfo } from '../logic/region';
import { selectData, useStore } from './useStore';

/** All persisted data (no actions), re-rendering only when data changes. */
export function useAppData() {
  return useStore(useShallow(selectData));
}

export function useMoney() {
  const settings = useStore((s) => s.settings);
  return useMemo(
    () => ({
      money: (n: number) => formatMoney(n, settings.currency, settings.locale, currencyInfo(settings.currencyCode).decimals ?? 0),
      compact: (n: number) => formatCompact(n, settings.currency, ['IN', 'SA_ASIA'].includes(currencyInfo(settings.currencyCode).region)),
    }),
    [settings.currency, settings.locale, settings.currencyCode],
  );
}

export function useBalances() {
  const accounts = useStore((s) => s.accounts);
  const txns = useStore((s) => s.transactions);
  return useMemo(() => computeBalances(accounts, txns), [accounts, txns]);
}

/** Current spending cycle (salary-day based or calendar month). */
export function useCycle() {
  const startDay = useStore((s) => s.settings.cycleStartDay ?? 1);
  return useMemo(() => {
    const on = new Date();
    const key = currentCycleKey(on, startDay);
    return { startDay, key, label: cycleLabel(key, startDay), ...cycleBounds(key, startDay), progress: cycleProgress(on, startDay) };
  }, [startDay]);
}
