import { addDays, diffDays, parseDate } from './dates';
import type { PriceEntry } from './types';

export const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export interface ShopPrice {
  shop: string;
  price: number;
  date: string;
}

export interface ItemComparison {
  item: string;
  unit?: string;
  shops: ShopPrice[]; // latest price per shop, cheapest first
  cheapest: ShopPrice;
  /** Shop the family buys this item from most often. */
  usual: ShopPrice;
  /** Saving per unit by switching from usual to cheapest */
  savingPerUnit: number;
  /** How many times the item was bought in the last 90 days */
  purchases90d: number;
}

export function compareItems(prices: PriceEntry[], on: Date): ItemComparison[] {
  const byItem = new Map<string, PriceEntry[]>();
  for (const p of prices) {
    const k = normalize(p.item);
    byItem.set(k, [...(byItem.get(k) ?? []), p]);
  }
  const since = addDays(on, -90);
  const out: ItemComparison[] = [];
  for (const entries of byItem.values()) {
    const latest = new Map<string, ShopPrice>();
    const visits = new Map<string, number>();
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
      const shopKey = normalize(e.shop);
      latest.set(shopKey, { shop: e.shop.trim(), price: e.price, date: e.date });
      visits.set(shopKey, (visits.get(shopKey) ?? 0) + 1);
    }
    const shops = [...latest.values()].sort((a, b) => a.price - b.price);
    const usualKey = [...visits.entries()].sort((a, b) => b[1] - a[1] || 0)[0][0];
    const usual = latest.get(usualKey)!;
    const cheapest = shops[0];
    const purchases90d = entries.filter((e) => diffDays(parseDate(e.date), since) >= 0).length;
    out.push({
      item: entries[entries.length - 1].item.trim(),
      unit: entries.find((e) => e.unit)?.unit,
      shops,
      cheapest,
      usual,
      savingPerUnit: Math.max(0, usual.price - cheapest.price),
      purchases90d,
    });
  }
  return out.sort((a, b) => b.savingPerUnit * Math.max(1, b.purchases90d) - a.savingPerUnit * Math.max(1, a.purchases90d));
}
