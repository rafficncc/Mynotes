/** Free-plan limits for scans and voice entries, counted per calendar month. */
export const FREE_MONTHLY = 10;

/** Screens that need Premium. */
export const PREMIUM_ROUTES = ['/family', '/vault', '/investments', '/policies', '/claims', '/remittance', '/events', '/vehicles', '/reports', '/year', '/challenges', '/debts'];

export type UseKind = 'scans' | 'voice';
export type Usage = { month: string; scans: number; voice: number };

const monthOf = (on: Date) => `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, '0')}`;

/** Free uses left this month; counters reset when the month changes. */
export function usesLeft(usage: Usage | undefined, kind: UseKind, on: Date): number {
  const used = usage?.month === monthOf(on) ? usage[kind] : 0;
  return Math.max(0, FREE_MONTHLY - used);
}

export function countUse(usage: Usage | undefined, kind: UseKind, on: Date): Usage {
  const base = usage?.month === monthOf(on) ? usage : { month: monthOf(on), scans: 0, voice: 0 };
  return { ...base, [kind]: base[kind] + 1 };
}
