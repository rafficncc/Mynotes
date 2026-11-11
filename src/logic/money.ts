export function formatMoney(amount: number, currency = '₹', locale = 'en-IN', decimals = 0): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const body = abs.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${currency}${body}`;
}

/** Compact form: ₹1.2L, ₹45K */
export function formatCompact(amount: number, currency = '₹'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}${currency}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}${currency}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${currency}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${currency}${Math.round(abs)}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1000;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
