import { describe, expect, it } from 'vitest';
import { STRINGS } from './strings';

describe('translations', () => {
  it('has 5 non-empty columns and no duplicate keys', () => {
    const keys = new Set<string>();
    for (const row of STRINGS) {
      expect(row).toHaveLength(5);
      for (const cell of row) expect(cell.trim().length).toBeGreaterThan(0);
      expect(keys.has(row[0])).toBe(false);
      keys.add(row[0]);
    }
  });
});
