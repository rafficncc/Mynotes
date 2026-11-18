import { parseDate, toISODate } from './dates';
import { normalize } from './text';
import type { AccountType, Transaction } from './types';

/**
 * Turns the text read from a photographed bill into expense details.
 *
 * Works on lines with their position on the image (as returned by on-device OCR). Receipts
 * often come back with the item name and its price as separate lines, so lines are first
 * grouped into visual rows by their vertical position.
 */

export interface OcrLine {
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Tilt of this line (vertical change per pixel across), measured from its words' positions. */
  slope?: number;
}

/** Slope of a line from the centres of its words (least squares). Needs 2+ words spread out. */
export function lineSlope(words: { left: number; right: number; top: number; bottom: number }[]): number | undefined {
  if (words.length < 2) return undefined;
  const pts = words.map((w) => ({ x: (w.left + w.right) / 2, y: (w.top + w.bottom) / 2 }));
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx < 100 ** 2) return undefined;
  return pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type PaymentMethod = 'card' | 'upi' | 'cash';

export interface ParsedReceipt {
  merchant?: string;
  date?: string;
  total?: number;
  /** high = found next to a "total" word; low = best guess (largest amount) */
  totalConfidence?: 'high' | 'low';
  items: ReceiptItem[];
  payment?: { method: PaymentMethod; last4?: string };
  categoryId?: string;
  currency?: string;
  rows: string[];
}

/* ------------------------------ rows ------------------------------ */

/**
 * Groups OCR lines into rows (same visual line), left to right. Lines join the row they overlap
 * most vertically; checking the last few rows tolerates a slightly tilted photo, where the price
 * at the right edge sits a little higher or lower than the item name.
 */
export function toRows(lines: OcrLine[]): string[] {
  // Straighten a tilted photo: shift each line by the page's tilt at its horizontal position.
  const slopes = lines.map((l) => l.slope).filter((x): x is number => x !== undefined && Math.abs(x) < 0.2);
  const tilt = slopes.length >= 3 ? median(slopes) : 0;
  const sorted = lines
    .filter((l) => l.text.trim())
    .map((l) => {
      // A tilted line's box is taller than its text; use the box height minus the tilt over its width.
      const shift = tilt * ((l.left + l.right) / 2);
      const h = Math.max(1, l.bottom - l.top - Math.abs(tilt) * (l.right - l.left));
      const mid = (l.top + l.bottom) / 2 - shift;
      return { ...l, top: mid - h / 2, bottom: mid + h / 2, h };
    })
    .sort((a, b) => a.top + a.bottom - (b.top + b.bottom));
  type Row = { items: typeof sorted; top: number; bottom: number };
  const rows: Row[] = [];
  for (const l of sorted) {
    let best: Row | null = null;
    let bestOverlap = 0;
    for (const row of rows.slice(-3)) {
      // Only join lines that don't sit on top of each other horizontally
      if (row.items.some((x) => l.left < x.right - 5 && x.left < l.right - 5)) continue;
      const overlap = Math.min(l.bottom, row.bottom) - Math.max(l.top, row.top);
      const ratio = overlap / Math.min(l.h, row.bottom - row.top);
      if (ratio > 0.35 && ratio > bestOverlap) {
        best = row;
        bestOverlap = ratio;
      }
    }
    if (best) {
      best.items.push(l);
    } else {
      rows.push({ items: [l], top: l.top, bottom: l.bottom });
    }
  }
  return rows.map((r) => r.items.sort((a, b) => a.left - b.left).map((x) => x.text.trim()).join('  '));
}

/* ------------------------------ amounts ------------------------------ */

// A money amount: 1,234.56 | 1.234,56 | 1,23,456.00 | 99.5 | 450 (optionally with currency).
// Spaces are not treated as thousands separators: on receipts they separate columns.
const AMOUNT_RE = /(?:₹|rs\.?|inr|aed|dhs?|sar|qar|usd|\$|£|€)?\s*(-?\d{1,3}(?:[,.]\d{2,3})*(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)(?![\d%])/gi;

/** Parses one amount token, handling Indian, US and European separators and common OCR slips. */
export function parseAmount(raw: string): number | null {
  let s = raw
    .replace(/[Oo](?=[\d.,])|(?<=[\d.,])[Oo]/g, '0')
    .replace(/[^\d.,-]/g, '')
    .trim();
  if (!s || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const dec = Math.max(lastDot, lastComma);
  // Decimal separator = last . or , followed by exactly 1–2 digits
  if (dec >= 0 && /^\d{1,2}$/.test(s.slice(dec + 1))) {
    const intPart = s.slice(0, dec).replace(/[.,\s]/g, '');
    s = `${intPart}.${s.slice(dec + 1)}`;
  } else {
    s = s.replace(/[.,\s]/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** All amounts in a row, left to right. Skips things that look like dates, times, phone or tax ids. */
export function amountsIn(row: string): number[] {
  const cleaned = row
    .replace(/\b\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' ') // dates
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ') // times
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}\b/g, ' ') // Indian GSTIN
    .replace(/\+?\d[\d\s-]{8,}\d/g, (m) => (/[.,]\d{2}$/.test(m) ? m : ' ')) // phone numbers
    .replace(/\b\d+(?:\.\d+)?\s*(?:%|kg|g|gm|ml|l|ltr|pcs|pc|nos)\b/gi, ' '); // sizes, percentages
  const out: number[] = [];
  for (const m of cleaned.matchAll(AMOUNT_RE)) {
    const n = parseAmount(m[1]);
    if (n !== null) out.push(n);
  }
  return out;
}

/* ------------------------------ total ------------------------------ */

const TOTAL_KEYS: [RegExp, number][] = [
  [/grand\s*total|g\.?\s*total/i, 10],
  [/net\s*(?:amount|amt|payable|total|pay)|amount\s*payable|total\s*payable|to\s*pay\b/i, 9],
  [/total\s*(?:amount|amt|due|inc|incl|bill)|bill\s*(?:amount|amt|total)|amount\s*due|balance\s*due|total\s*\(?(?:₹|rs|inr|aed|\$)/i, 8],
  [/\btotal\b|\btotai\b|\btota1\b/i, 5],
  [/\b(?:paid|tendered|card|visa|mastercard|upi)\b/i, 2],
];
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(?:items?|qty|quantity|savings?|saved|discount|tax|gst|vat|weight|pcs|mrp)|you\s*saved|change\s*due|\bitems?\s*:/i;

function findTotal(rows: string[]): { total?: number; confidence?: 'high' | 'low' } {
  let best: { score: number; value: number; index: number } | null = null;
  rows.forEach((row, i) => {
    if (NOT_TOTAL.test(row)) return;
    const key = TOTAL_KEYS.find(([re]) => re.test(row));
    if (!key) return;
    let nums = amountsIn(row.replace(key[0], ' '));
    // Value often sits on the next row (separate OCR line)
    if (!nums.length && rows[i + 1] && !/[a-z]{3,}/i.test(rows[i + 1])) nums = amountsIn(rows[i + 1]);
    const value = nums.filter((n) => n > 0).pop();
    if (value === undefined) return;
    // Prefer stronger keywords; among equals prefer the lower one on the bill
    if (!best || key[1] > best.score || (key[1] === best.score && i > best.index)) best = { score: key[1], value, index: i };
  });
  if (best) {
    const b = best as { score: number; value: number };
    return { total: b.value, confidence: b.score >= 5 ? 'high' : 'low' };
  }
  // Fallback: the largest amount that has decimals (avoids bill numbers)
  const candidates = rows.flatMap((r) => (/\d[.,]\d{2}\b/.test(r) ? amountsIn(r) : [])).filter((n) => n > 0 && n < 10_000_000);
  return candidates.length ? { total: Math.max(...candidates), confidence: 'low' } : {};
}

/* ------------------------------ date ------------------------------ */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Month number (1-12) from a word, tolerating one misread letter (OCR "Noy" → Nov, "0ct" → Oct). */
function monthOf(word: string): number | undefined {
  const w = word.slice(0, 3).replace(/0/g, 'o');
  const exact = MONTHS.indexOf(w);
  if (exact >= 0) return exact + 1;
  const close = MONTHS.filter((m) => [0, 1, 2].filter((i) => m[i] === w[i]).length === 2);
  return close.length === 1 ? MONTHS.indexOf(close[0]) + 1 : undefined;
}

function validDate(y: number, m: number, d: number, today: Date): string | undefined {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return undefined;
  const iso = toISODate(dt);
  const ageDays = (today.getTime() - dt.getTime()) / 86400000;
  return ageDays >= -1 && ageDays <= 730 ? iso : undefined;
}

/** Finds the bill date. `monthFirst` for US-style 11/05/2026 = 5 Nov. */
export function findDate(rows: string[], today: Date, monthFirst = false): string | undefined {
  for (const row of rows) {
    const r = row.toLowerCase();
    let m = r.match(/\b(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
    if (m) {
      const v = validDate(+m[1], +m[2], +m[3], today);
      if (v) return v;
    }
    m = r.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
    if (m) {
      // Day-first unless the currency says month-first; a value over 12 settles it either way.
      let [day, month] = [+m[1], +m[2]];
      if (monthFirst) [day, month] = [month, day];
      if (month > 12 && day <= 12) [day, month] = [month, day];
      const v = validDate(+m[3], month, day, today);
      if (v) return v;
    }
    m = r.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]*([a-z0][a-z]{2})[a-z]*[\s,-]*'?(\d{2,4})\b/);
    if (m && monthOf(m[2])) {
      const v = validDate(+m[3], monthOf(m[2])!, +m[1], today);
      if (v) return v;
    }
    m = r.match(/\b([a-z0][a-z]{2})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (m && monthOf(m[1])) {
      const v = validDate(+m[3], monthOf(m[1])!, +m[2], today);
      if (v) return v;
    }
  }
  return undefined;
}

/* ------------------------------ merchant ------------------------------ */

const NOT_MERCHANT =
  /tax\s*invoice|invoice|receipt|bill\s*(?:no|#)|cash\s*memo|welcome|thank|gstin|gst\s*no|trn|vat\s*(?:no|reg)|tel|phone|ph[:.]|mob|fssai|cin\b|pan\b|www\.|\.com|@|date|time|cashier|counter|table|order|token|duplicate|original|copy|customer|road|rd\b|street|st\.|nagar|floor|plot|near|opp|po box|p\.o|\d{6}\b/i;

function cleanName(s: string): string {
  const t = s.replace(/[^\p{L}\p{N}&'.\- ]/gu, ' ').replace(/\s+/g, ' ').trim();
  // Title-case shouty names, keep short acronyms (e.g. "KFC")
  return t
    .split(' ')
    .map((w) => (w.length > 3 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function findMerchant(rows: string[], knownMerchants: string[]): string | undefined {
  const top = rows.slice(0, 8);
  // A shop the family has used before wins
  for (const known of knownMerchants) {
    const k = normalize(known);
    if (k.length >= 3 && top.some((r) => normalize(r).includes(k))) return known;
  }
  for (const row of top) {
    const letters = (row.match(/\p{L}/gu) ?? []).length;
    if (letters < 3 || NOT_MERCHANT.test(row)) continue;
    if (amountsIn(row).length && letters < 6) continue;
    const name = cleanName(row);
    if (name.length >= 3) return name.slice(0, 40);
  }
  return undefined;
}

/* ------------------------------ payment ------------------------------ */

function findPayment(rows: string[]): ParsedReceipt['payment'] {
  const text = rows.join('\n');
  const card = text.match(/(?:visa|master\s*card|mastercard|rupay|amex|american express|maestro|diners|debit|credit|card)[^\n]*?(?:x{2,}|\*{2,}|#{2,}|ending\s*(?:in)?)\s*[-\s]*(\d{4})/i);
  if (card) return { method: 'card', last4: card[1] };
  if (/\b(?:visa|master\s*card|mastercard|rupay|amex|card\s*(?:payment|paid|sale)|paid\s*by\s*card)\b/i.test(text)) return { method: 'card' };
  if (/\b(?:upi|gpay|google\s*pay|phonepe|phone\s*pe|paytm|bhim|apple\s*pay)\b/i.test(text)) return { method: 'upi' };
  if (/\bcash\b/i.test(text) && !/cash\s*memo/i.test(text)) return { method: 'cash' };
  return undefined;
}

/* ------------------------------ items ------------------------------ */

const NOT_ITEM =
  /total|sub\s*total|tax|gst|cgst|sgst|igst|vat|cess|discount|round|change|tender|paid|balance|cash|card|visa|upi|savings?|saved|amount|qty|quantity|rate|price|mrp|hsn|item\s*name|description|particulars|thank|invoice|bill|date|time|cashier|net\b|payable|service\s*charge|tip\b/i;

function findItems(rows: string[], total?: number): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  for (const row of rows) {
    if (NOT_ITEM.test(row)) continue;
    // "2 x 45.00" / "2 @ 45"
    const mult = row.match(/(\d+(?:\.\d+)?)\s*[x×@*]\s*(\d+(?:[.,]\d{1,2})?)/i);
    const nameMatch = row.match(/^[\s\d.)#-]*([\p{L}][\p{L}\p{N}&'().,/\- ]*?)(?=\s{2,}|\s+\d|$)/u);
    if (!nameMatch) continue;
    const name = cleanName(nameMatch[1].replace(/\s+\d+(?:\.\d+)?\s*(?:kg|g|gm|ml|l|ltr)?$/i, '').trim());
    if ((name.match(/\p{L}/gu) ?? []).length < 2) continue;
    const nums = amountsIn(row.slice(nameMatch.index! + nameMatch[0].length));
    if (!nums.length) continue;
    const amount = nums[nums.length - 1];
    if (amount <= 0 || (total !== undefined && amount > total + 0.01)) continue;
    let quantity = 1;
    let unitPrice = amount;
    if (mult) {
      quantity = Number(mult[1]);
      unitPrice = parseAmount(mult[2]) ?? amount / quantity;
    } else if (nums.length >= 3) {
      // qty, rate, amount (or rate, qty, amount)
      const [a, b] = nums.slice(-3);
      if (Math.abs(a * b - amount) < 0.05 * amount + 0.5) {
        const qtyFirst = Number.isInteger(a) && a < 100;
        quantity = qtyFirst ? a : b;
        unitPrice = qtyFirst ? b : a;
      }
    } else if (nums.length === 2) {
      const [a] = nums;
      if (Number.isInteger(a) && a > 0 && a < 50 && amount / a >= 1) {
        quantity = a;
        unitPrice = Math.round((amount / a) * 100) / 100;
      }
    }
    if (!quantity || !Number.isFinite(unitPrice)) continue;
    items.push({ name: name.slice(0, 40), quantity, unitPrice: Math.round(unitPrice * 100) / 100, amount });
    if (items.length >= 60) break;
  }
  return items;
}

/* ------------------------------ category ------------------------------ */

const CATEGORY_HINTS: [RegExp, string][] = [
  [/pharma|medical|chemist|drug|clinic|hospital|diagnostic|lab\b|health/i, 'health'],
  [/petrol|fuel|diesel|filling|service\s*station|indian\s*oil|iocl|bharat\s*petroleum|bpcl|hpcl|hindustan\s*petroleum|adnoc|enoc|eppco|shell|parking|toll|metro|uber|ola\b|careem|taxi/i, 'transport'],
  [/restaurant|cafe|caf[eé]|coffee|bakery|bakers|kitchen|dhaba|biryani|pizza|burger|food|eat|dine|grill|bistro|tea\b|juice|sweets|swiggy|zomato|talabat|deliveroo/i, 'dining'],
  [/super\s*market|supermarket|hyper|mart\b|grocer|kirana|provision|fresh|vegetable|fruits|dairy|milk|bread|eggs?\b|rice|atta|sugar|grocer(y|ies)|stores?\b|bazaar|lulu|carrefour|spinneys|dmart|reliance\s*fresh|more\b|nesto|choithrams|big\s*basket|blinkit|zepto|instamart|walmart|costco|tesco|aldi|lidl/i, 'groceries'],
  [/electric|power|water|gas\b|dewa|sewa|addc|kseb|bescom|tneb|msedcl/i, 'utilities'],
  [/airtel|jio|vodafone|vi\b|bsnl|etisalat|\bdu\b|telecom|mobile|broadband|internet|wifi/i, 'telecom'],
  [/cinema|movies|pvr|inox|vox|theatre|theater|gaming|amusement|park/i, 'entertainment'],
  [/school|college|academy|tuition|books|stationery|university/i, 'education'],
  [/salon|spa|parlour|parlor|barber|beauty|grooming/i, 'personal'],
  [/fashion|apparel|clothing|garments|textile|trends|lifestyle|footwear|shoes|electronics|digital|mall|ikea|decathlon|max\b|centrepoint|home\s*centre/i, 'shopping'],
  [/hotel|resort|airlines|airways|travel|tours/i, 'travel'],
  [/toys|kids|baby/i, 'kids'],
];

export function guessCategory(merchant: string | undefined, rows: string[], history: Transaction[]): string | undefined {
  if (merchant) {
    const m = normalize(merchant);
    const counts = new Map<string, number>();
    for (const t of history) {
      if (t.type === 'expense' && t.merchant && normalize(t.merchant) === m && t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  }
  const text = [merchant ?? '', ...rows.slice(0, 10)].join(' ');
  return CATEGORY_HINTS.find(([re]) => re.test(text))?.[1];
}

function findCurrency(rows: string[]): string | undefined {
  const t = rows.join(' ');
  if (/₹|\brs\.?\s?\d|\binr\b/i.test(t)) return 'INR';
  if (/\baed\b|\bdhs?\b|\bdirhams?\b/i.test(t)) return 'AED';
  if (/\bsar\b|riyals?/i.test(t)) return 'SAR';
  if (/£|\bgbp\b/i.test(t)) return 'GBP';
  if (/€|\beur\b/i.test(t)) return 'EUR';
  if (/\$|\busd\b/i.test(t)) return 'USD';
  return undefined;
}

/* ------------------------------ main ------------------------------ */

export function parseReceipt(
  lines: OcrLine[] | string[],
  opts: { today?: Date; monthFirst?: boolean; history?: Transaction[] } = {},
): ParsedReceipt {
  const rows = typeof lines[0] === 'string' ? (lines as string[]).map((l) => l.trim()).filter(Boolean) : toRows(lines as OcrLine[]);
  const today = opts.today ?? new Date();
  const history = opts.history ?? [];
  const knownMerchants = [...new Set(history.filter((t) => t.merchant).map((t) => t.merchant!.trim()))].sort((a, b) => b.length - a.length);
  const { total, confidence } = findTotal(rows);
  const merchant = findMerchant(rows, knownMerchants);
  const items = findItems(rows, total);
  return {
    merchant,
    date: findDate(rows, today, opts.monthFirst),
    total,
    totalConfidence: confidence,
    items,
    payment: findPayment(rows),
    categoryId: guessCategory(merchant, rows, history),
    currency: findCurrency(rows),
    rows,
  };
}

/** Picks the account that matches the payment on the bill, when there is exactly one sensible match. */
export function matchAccount(
  payment: ParsedReceipt['payment'],
  accounts: { id: string; name: string; type: AccountType; archived?: boolean }[],
): string | undefined {
  if (!payment) return undefined;
  const active = accounts.filter((a) => !a.archived);
  if (payment.last4) {
    const byDigits = active.find((a) => a.name.includes(payment.last4!));
    if (byDigits) return byDigits.id;
  }
  const types: AccountType[] = payment.method === 'cash' ? ['cash'] : payment.method === 'upi' ? ['wallet', 'bank'] : ['credit_card', 'debit_card'];
  for (const t of types) {
    const list = active.filter((a) => a.type === t);
    if (list.length === 1) return list[0].id;
  }
  return undefined;
}

export { parseDate };
