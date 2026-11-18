import { describe, expect, it } from 'vitest';
import { parseSpoken } from './voice';
import type { Account } from './types';

const acc = (id: string, name: string, type: Account['type']): Account => ({ id, name, type, openingBalance: 0, createdAt: '' });
const accounts = [acc('cash', 'Cash wallet', 'cash'), acc('bank', 'Salary account', 'bank'), acc('upi', 'UPI wallet', 'wallet'), acc('hdfc', 'HDFC Rewards Card', 'credit_card')];

describe('voice entry', () => {
  it('understands "200 cash milk"', () => {
    expect(parseSpoken('200 cash milk', accounts)).toEqual({ type: 'expense', amount: 200, accountId: 'cash', categoryId: 'groceries', merchant: 'Milk' });
  });

  it('picks a named card and a category', () => {
    const r = parseSpoken('spent 450 on petrol with HDFC card', accounts);
    expect(r).toMatchObject({ amount: 450, accountId: 'hdfc', categoryId: 'transport', merchant: 'Petrol' });
  });

  it('handles income, commas, UPI and "k"', () => {
    expect(parseSpoken('received 85,000 salary in bank', accounts)).toMatchObject({ type: 'income', amount: 85000, accountId: 'bank', categoryId: 'salary' });
    expect(parseSpoken('1.5k gpay pizza', accounts)).toMatchObject({ amount: 1500, accountId: 'upi', categoryId: 'dining', merchant: 'Pizza' });
  });

  it('leaves unknown parts empty', () => {
    expect(parseSpoken('groceries', accounts)).toMatchObject({ amount: undefined, accountId: undefined, merchant: 'Groceries' });
  });
});
