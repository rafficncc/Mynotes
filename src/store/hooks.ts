import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { toast } from '../components/Toast';
import { computeBalances, ledgerAccountId } from '../logic/balances';
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
      // "Hide amounts" privacy mode masks every amount on screen.
      money: (n: number) => (settings.hideAmounts ? `${settings.currency}••••` : formatMoney(n, settings.currency, settings.locale, currencyInfo(settings.currencyCode).decimals ?? 0)),
      compact: (n: number) => (settings.hideAmounts ? `${settings.currency}••••` : formatCompact(n, settings.currency, ['IN', 'SA_ASIA'].includes(currencyInfo(settings.currencyCode).region))),
    }),
    [settings.currency, settings.locale, settings.currencyCode, settings.hideAmounts],
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

/** Confirms a money action with the account's new balance, e.g. "Saved · Salary account balance now ₹81,361". */
export function notifyBalance(accountId: string | undefined, prefix: string) {
  const s = useStore.getState();
  const acc = s.accounts.find((a) => a.id === accountId);
  if (!acc) return toast(prefix);
  const bal = computeBalances(s.accounts, s.transactions)[ledgerAccountId(s.accounts, acc.id)] ?? 0;
  const c = currencyInfo(s.settings.currencyCode);
  const shown = s.settings.hideAmounts ? `${s.settings.currency}••••` : formatMoney(acc.type === 'credit_card' || acc.type === 'loan' ? -bal : bal, s.settings.currency, s.settings.locale, c.decimals ?? 0);
  toast(`${prefix} · ${acc.name} ${acc.type === 'credit_card' || acc.type === 'loan' ? 'outstanding' : 'balance'} now ${shown}`);
}
