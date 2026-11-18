import { normalize } from './priceBook';
import { guessCategory } from './receipt';
import type { Account, Transaction, TxnType } from './types';

export interface SpokenEntry {
  type: TxnType;
  amount?: number;
  accountId?: string;
  categoryId?: string;
  merchant?: string;
}

const INCOME = /\b(received|got|salary|income|earned|credited|refund)\b/i;
const FILLER = /\b(i|spent|spend|paid|pay|bought|buy|for|on|with|by|from|at|to|the|a|an|of|in|using|via|rupees?|rs|inr|dirhams?|aed|dollars?|riyals?|received|got|credited|earned|today|yesterday|and)\b/gi;
const ACCOUNT_WORDS: [RegExp, Account['type'][]][] = [
  [/\bcash\b/i, ['cash']],
  [/\b(upi|gpay|google pay|phone ?pe|paytm|bhim|wallet)\b/i, ['wallet', 'bank']],
  [/\bdebit( card)?\b/i, ['debit_card']],
  [/\b(credit card|card)\b/i, ['credit_card', 'debit_card']],
  [/\b(bank|account|net ?banking|transfer)\b/i, ['bank']],
];

/**
 * Understands short spoken or typed entries like "200 cash milk", "spent 450 on petrol with
 * HDFC card" or "received 85000 salary in bank".
 */
export function parseSpoken(text: string, accounts: Account[], history: Transaction[] = []): SpokenEntry {
  let rest = ` ${text.trim()} `;
  const type: TxnType = INCOME.test(text) ? 'income' : 'expense';

  const num = rest.match(/(\d[\d,]*(?:\.\d{1,2})?)\s*(k|thousand|lakh|lac)?\b/i);
  let amount: number | undefined;
  if (num) {
    const mult = { k: 1000, thousand: 1000, lakh: 100000, lac: 100000 }[(num[2] ?? '').toLowerCase() as 'k'] ?? 1;
    amount = parseFloat(num[1].replace(/,/g, '')) * mult;
    rest = rest.replace(num[0], ' ');
  }

  // A named account wins ("HDFC card", "salary account"); otherwise the only account of the spoken kind.
  const active = accounts.filter((a) => !a.archived && a.type !== 'people');
  let accountId: string | undefined;
  for (const a of [...active].sort((x, y) => y.name.length - x.name.length)) {
    const words = normalize(a.name).split(' ').filter((w) => w.length > 2 && !['card', 'account', 'wallet'].includes(w));
    const hit = words.find((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rest));
    if (hit) {
      accountId = a.id;
      rest = rest.replace(new RegExp(`\\b${normalize(a.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|\\b${hit}\\b`, 'i'), ' ');
      break;
    }
  }
  for (const [re, types] of ACCOUNT_WORDS) {
    if (!re.test(rest)) continue;
    if (!accountId) {
      for (const t of types) {
        const list = active.filter((a) => a.type === t);
        if (list.length) {
          accountId = list[0].id;
          break;
        }
      }
    }
    rest = rest.replace(re, ' ');
  }

  const words = rest.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  const merchant = words ? words.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
  const categoryId = type === 'income' ? (/salary/i.test(text) ? 'salary' : 'other_income') : guessCategory(merchant, [text], history);
  return { type, amount, accountId, categoryId, merchant };
}
