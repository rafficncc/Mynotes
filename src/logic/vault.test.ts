import { describe, expect, it } from 'vitest';
import { buildDemoData } from './demo';
import { looksSecret, readiness, VAULT_CATEGORIES, vaultHtml, vaultRows } from './vault';

const on = new Date(2026, 10, 27);
const data = buildDemoData(on);

describe('money vault', () => {
  it('shows app items once, merged with the details the user added', () => {
    const rows = vaultRows(data);
    const salary = rows.filter((r) => r.key === 'bank');
    expect(salary).toHaveLength(1);
    expect(salary[0].nominee).toBe('Priya (wife)');
    expect(salary[0].extra?.last4).toBe('4321');
    // app items without user details still appear (e.g. money lent to Ravi)
    expect(rows.some((r) => r.section === 'lent' && r.title.startsWith('Ravi'))).toBe(true);
  });

  it('demo data covers every topic, counting "I don’t have this"', () => {
    const r = readiness(data);
    const rows = vaultRows(data);
    const missing = VAULT_CATEGORIES.filter((c) => !rows.some((x) => x.section === c.key) && !(data.settings.vaultNA ?? []).includes(c.key)).map((c) => c.key);
    expect(missing).toEqual([]);
    expect(r.total).toBe(VAULT_CATEGORIES.length);
    expect(r.percent).toBe(100);
  });

  it('flags items with no nominee', () => {
    const r = readiness({ ...data, vault: [] });
    expect(r.missingNominee.some((x) => x.title === 'Salary account')).toBe(true);
    expect(r.percent).toBeLessThan(100);
  });

  it('spots secrets', () => {
    expect(looksSecret('ATM PIN is 1234')).toBe(true);
    expect(looksSecret('card 4111 1111 1111 1111')).toBe(true);
    expect(looksSecret('Key in the steel box')).toBe(false);
  });

  it('builds the family file with Start here first and escaped text', () => {
    const html = vaultHtml({ ...data, vault: [...data.vault, { id: 'x', section: 'other', title: '<b>x</b>', detail: '' }] }, (n) => `₹${n}`, 'Me', on);
    expect(html.indexOf('Start here')).toBeLessThan(html.indexOf('Bank accounts'));
    expect(html).toContain('Rajesh (brother)');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('own topics', () => {
  it('adds custom topics and groups to readiness, rows and the family file', () => {
    const d = {
      ...data,
      settings: { ...data.settings, vaultCustom: [{ key: 'custom-a1', group: 'Business', label: 'Chit fund' }] },
      vault: [...data.vault, { id: 'c1', section: 'custom-a1', title: 'Sree Gokulam chit', detail: 'Monthly ₹10,000', nominee: 'Priya' }],
    };
    expect(readiness(d).total).toBe(VAULT_CATEGORIES.length + 1);
    expect(vaultRows(d).find((r) => r.key === 'c1')?.section).toBe('custom-a1');
    const html = vaultHtml(d, String, 'Me', on);
    expect(html).toContain('Business');
    expect(html).toContain('Chit fund');
    // deleting the topic keeps the item, under "Anything else"
    const removed = { ...d, settings: { ...d.settings, vaultCustom: [] } };
    expect(vaultRows(removed).find((r) => r.key === 'c1')?.section).toBe('other');
  });
});
