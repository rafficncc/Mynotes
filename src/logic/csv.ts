import type { AppData } from './types';

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function transactionsToCsv(data: AppData): string {
  const name = (id?: string) => data.accounts.find((a) => a.id === id)?.name ?? '';
  const cat = (id?: string) => data.categories.find((c) => c.id === id)?.name ?? '';
  const mem = (id?: string) => data.members.find((m) => m.id === id)?.name ?? '';
  const rows = [['Date', 'Type', 'Amount', 'Account', 'To account', 'Category', 'Merchant', 'Member', 'Item', 'Qty', 'Note']];
  for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([t.date, t.type, String(t.amount), name(t.accountId), name(t.toAccountId), cat(t.categoryId), t.merchant ?? '', mem(t.memberId), t.item ?? '', t.quantity ? String(t.quantity) : '', t.note ?? '']);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
