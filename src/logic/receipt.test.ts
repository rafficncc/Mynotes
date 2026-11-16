import { describe, expect, it } from 'vitest';
import { parseDate } from './dates';
import { amountsIn, matchAccount, parseAmount, parseReceipt, toRows, type OcrLine } from './receipt';
import type { Transaction } from './types';

const today = parseDate('2026-11-16');
const rows = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

describe('amount parsing', () => {
  it('handles Indian, US and European formats', () => {
    expect(parseAmount('1,23,456.50')).toBe(123456.5);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('₹ 450')).toBe(450);
    expect(parseAmount('2O5.0O')).toBe(205);
  });

  it('ignores dates, times, phone numbers and sizes', () => {
    expect(amountsIn('Date 12/11/2026 10:45 AM')).toEqual([]);
    expect(amountsIn('Ph: +91 98450 12345')).toEqual([]);
    expect(amountsIn('Milk 1L 2 x 30.00 60.00')).toEqual([2, 30, 60]);
    expect(amountsIn('GST 5% 12.50')).toEqual([12.5]);
  });
});

describe('Indian supermarket bill', () => {
  const r = parseReceipt(
    rows(`
      FRESHMART SUPERMARKET
      12, MG Road, Bengaluru 560001
      GSTIN: 29ABCDE1234F1Z5
      TAX INVOICE
      Bill No: 4521   Date: 14/11/2026  18:32
      Item            Qty   Rate    Amount
      Toned Milk 1L    2    30.00    60.00
      Basmati Rice 5kg 1   425.00   425.00
      Sunflower Oil 1L 2   165.00   330.00
      Bananas          1    48.00    48.00
      Sub Total                     863.00
      CGST 2.5%                      10.79
      SGST 2.5%                      10.79
      Round Off                       -0.58
      Grand Total               ₹ 884.00
      Paid by UPI (PhonePe)
      Total Items: 4    You saved ₹ 22.00
      Thank you! Visit again
    `),
    { today },
  );

  it('finds merchant, date, total and payment', () => {
    expect(r.merchant).toBe('Freshmart Supermarket');
    expect(r.date).toBe('2026-11-14');
    expect(r.total).toBe(884);
    expect(r.totalConfidence).toBe('high');
    expect(r.payment?.method).toBe('upi');
    expect(r.categoryId).toBe('groceries');
    expect(r.currency).toBe('INR');
  });

  it('reads items with quantity and unit price', () => {
    expect(r.items.map((i) => i.name)).toEqual(['Toned Milk', 'Basmati Rice', 'Sunflower Oil', 'Bananas']);
    const milk = r.items[0];
    expect(milk.quantity).toBe(2);
    expect(milk.unitPrice).toBe(30);
    expect(r.items[2]).toMatchObject({ quantity: 2, unitPrice: 165, amount: 330 });
  });
});

describe('UAE hypermarket bill (VAT, card)', () => {
  const r = parseReceipt(
    rows(`
      GREEN VALLEY HYPERMARKET LLC
      Al Nahda, Dubai - UAE
      TRN 100234567800003
      Tax Invoice
      Date: 03-Nov-2026 Time 21:14
      LABAN UP 1L          2 x 4.75      9.50
      ARABIC BREAD                         2.00
      CHICKEN BREAST 1KG                  27.95
      Total Excl. VAT                     37.57
      VAT 5%                               1.88
      TOTAL AED                           39.45
      VISA ************4821               39.45
    `),
    { today },
  );

  it('finds everything', () => {
    expect(r.merchant).toBe('Green Valley Hypermarket LLC');
    expect(r.date).toBe('2026-11-03');
    expect(r.total).toBe(39.45);
    expect(r.payment).toEqual({ method: 'card', last4: '4821' });
    expect(r.currency).toBe('AED');
    expect(r.categoryId).toBe('groceries');
    expect(r.items[0]).toMatchObject({ name: 'Laban UP', quantity: 2, unitPrice: 4.75, amount: 9.5 });
    expect(r.items.map((i) => i.name)).toContain('Chicken Breast');
  });
});

describe('restaurant bill', () => {
  const r = parseReceipt(
    rows(`
      SPICE ROUTE KITCHEN
      Indiranagar, Bengaluru
      Table: 7   Covers: 4
      Date: 9 Nov 2026
      Paneer Tikka        1   320.00
      Butter Naan         4    60.00   240.00
      Dal Makhani         1   280.00
      Sub total                840.00
      Service charge 5%         42.00
      GST 5%                    44.10
      Net Payable              926.10
      Payment: CASH
    `),
    { today },
  );

  it('uses Net Payable and categorises as dining', () => {
    expect(r.total).toBe(926.1);
    expect(r.date).toBe('2026-11-09');
    expect(r.categoryId).toBe('dining');
    expect(r.payment?.method).toBe('cash');
    expect(r.items.find((i) => i.name === 'Butter Naan')).toMatchObject({ quantity: 4, unitPrice: 60, amount: 240 });
  });
});

describe('US receipt', () => {
  it('reads month-first dates when asked', () => {
    const r = parseReceipt(rows('CORNER DELI\n11/05/2026 2:31 PM\nCoffee 3.50\nBagel 2.25\nTOTAL $5.75\nMASTERCARD XXXX1234'), { today, monthFirst: true });
    expect(r.date).toBe('2026-11-05');
    expect(r.total).toBe(5.75);
    expect(r.payment).toEqual({ method: 'card', last4: '1234' });
  });
});

describe('fuel receipt with total on the next line', () => {
  it('takes the value below the label', () => {
    const r = parseReceipt(rows('CITY FUELS - BPCL\nPetrol\nRate 102.86\nVolume 9.72\nTotal Amount\n1000.00\n20-Oct-2026'), { today });
    expect(r.total).toBe(1000);
    expect(r.categoryId).toBe('transport');
    expect(r.date).toBe('2026-10-20');
  });
});

describe('robustness', () => {
  it('falls back to the largest decimal amount when there is no total word', () => {
    const r = parseReceipt(rows('Kirana Corner\nSugar 1kg 52.00\nTea 250g 140.00\n192.00'), { today });
    expect(r.total).toBe(192);
    expect(r.totalConfidence).toBe('low');
  });

  it('reads OCR-misread month names', () => {
    expect(parseReceipt(rows('Shop\nDate: 9 Noy 2026\nTotal 10.00'), { today }).date).toBe('2026-11-09');
    expect(parseReceipt(rows('Shop\n12 0ct 2026\nTotal 10.00'), { today }).date).toBe('2026-10-12');
  });

  it('ignores dates in the future or far past', () => {
    expect(parseReceipt(rows('Shop\n01/01/2031\nTotal 10.00'), { today }).date).toBeUndefined();
  });

  it('prefers a merchant the family already uses', () => {
    const history = [{ id: '1', type: 'expense', amount: 1, date: '2026-10-01', accountId: 'a', merchant: 'Apollo Pharmacy', categoryId: 'health', createdAt: '' } as Transaction];
    const r = parseReceipt(rows('WELCOME TO\nAPOLLO PHARMACY - KORAMANGALA\nParacetamol 650 1 30.00\nTotal 30.00'), { today, history });
    expect(r.merchant).toBe('Apollo Pharmacy');
    expect(r.categoryId).toBe('health');
  });
});

describe('row grouping from OCR line positions', () => {
  it('straightens a tilted photo using line slopes', () => {
    // 4° tilt: things further right sit lower; the price drifts by a whole row height
    const tilt = 0.07;
    const at = (text: string, row: number, left: number, w = 120): OcrLine => {
      const y = 100 + row * 32 + tilt * (left + w / 2);
      return { text, top: y - 10, bottom: y + 10, left, right: left + w, slope: tilt };
    };
    const out = toRows([at('Grand Total', 0, 10), at('884.00', 0, 400), at('Paid by UPI', 1, 10), at('Thank you', 2, 10)]);
    expect(out[0]).toBe('Grand Total  884.00');
  });

  it('joins item name and price that OCR returned separately', () => {
    const line = (text: string, top: number, left: number): OcrLine => ({ text, top, bottom: top + 20, left, right: left + 100 });
    const out = toRows([line('Total', 300, 10), line('Milk', 100, 10), line('60.00', 103, 300), line('884.00', 302, 300), line('Rice', 140, 10), line('425.00', 138, 300)]);
    expect(out).toEqual(['Milk  60.00', 'Rice  425.00', 'Total  884.00']);
  });
});

describe('account matching', () => {
  const accounts = [
    { id: 'c1', name: 'HDFC Card 4821', type: 'credit_card' as const },
    { id: 'c2', name: 'Shopping Card', type: 'credit_card' as const },
    { id: 'cash', name: 'Cash', type: 'cash' as const },
    { id: 'upi', name: 'UPI wallet', type: 'wallet' as const },
  ];
  it('matches by last 4 digits, or by the only account of that kind', () => {
    expect(matchAccount({ method: 'card', last4: '4821' }, accounts)).toBe('c1');
    expect(matchAccount({ method: 'card' }, accounts)).toBeUndefined();
    expect(matchAccount({ method: 'cash' }, accounts)).toBe('cash');
    expect(matchAccount({ method: 'upi' }, accounts)).toBe('upi');
  });
});
