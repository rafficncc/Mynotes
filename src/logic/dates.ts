/** Date helpers working on local calendar dates in YYYY-MM-DD form. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISODate(new Date());
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Builds a date, clamping the day to the month length (e.g. day 31 in Feb → 28/29). */
export function clampedDate(year: number, monthIndex: number, day: number): Date {
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  return new Date(y, m, Math.min(day, daysInMonth(y, m)));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffDays(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / 86400000);
}

/** "2026-11" */
export function monthKey(s: string): string {
  return s.slice(0, 7);
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toISODate(d).slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short' });
}

export function formatDate(s: string): string {
  return parseDate(s).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

/* ---------- Spending cycle (e.g. salary day to the day before next salary) ---------- */

/** Cycle key = 'YYYY-MM' of the month in which the cycle starts. With startDay 1 it equals the calendar month. */
export function cycleKeyOf(dateStr: string, startDay = 1): string {
  if (startDay <= 1) return dateStr.slice(0, 7);
  const d = parseDate(dateStr);
  const start = clampedDate(d.getFullYear(), d.getMonth(), startDay);
  return diffDays(d, start) >= 0 ? dateStr.slice(0, 7) : shiftMonthKey(dateStr.slice(0, 7), -1);
}

export function cycleBounds(key: string, startDay = 1): { start: Date; end: Date } {
  const [y, m] = key.split('-').map(Number);
  const start = clampedDate(y, m - 1, Math.max(1, startDay));
  const next = clampedDate(y, m, Math.max(1, startDay));
  return { start, end: addDays(next, -1) };
}

export function currentCycleKey(on: Date, startDay = 1): string {
  return cycleKeyOf(toISODate(on), startDay);
}

/** Days elapsed in the cycle (including today) and total cycle length. */
export function cycleProgress(on: Date, startDay = 1): { elapsed: number; length: number; left: number } {
  const { start, end } = cycleBounds(currentCycleKey(on, startDay), startDay);
  const length = diffDays(end, start) + 1;
  const elapsed = diffDays(on, start) + 1;
  return { elapsed, length, left: length - elapsed + 1 };
}

export function cycleLabel(key: string, startDay = 1): string {
  if (startDay <= 1) return `${monthLabel(key)} ${key.slice(0, 4)}`;
  const { start, end } = cycleBounds(key, startDay);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** Adds months keeping the day (clamped), e.g. 31 Jan + 1 → 28/29 Feb. */
export function addMonths(d: Date, n: number, day = d.getDate()): Date {
  return clampedDate(d.getFullYear(), d.getMonth() + n, day);
}
