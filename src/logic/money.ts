export function formatMoney(amount: number, currency = '₹', locale = 'en-IN', decimals = 0): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const body = abs.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${currency}${body}`;
}

/** Compact form: ₹1.2L / ₹45K (Indian system) or $1.2M / $45K (international). */
export function formatCompact(amount: number, currency = '₹', indian = true): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (!indian) {
    if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e4) return `${sign}${currency}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${currency}${Math.round(abs).toLocaleString('en')}`;
  }
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
