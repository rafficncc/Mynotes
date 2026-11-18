import { Platform } from 'react-native';

/**
 * Lifetime Premium via Google Play Billing / App Store (expo-iap).
 * The product must exist in Play Console / App Store Connect with this id as a one-time,
 * non-consumable in-app product; prices per country are set there (FamilyFin suggests
 * ₹2,500-equivalent in each currency on the Premium screen).
 * shortcut: purchases are trusted on the device; add server-side receipt checks if piracy matters.
 */
export const PREMIUM_SKU = 'familyfin_premium_lifetime';

type Iap = typeof import('expo-iap');
let iapPromise: Promise<Iap | null> | null = null;

/** Loads the store module (absent on web and in Expo Go) and opens the store connection once. */
function iap(): Promise<Iap | null> {
  iapPromise ??= (async () => {
    if (Platform.OS === 'web') return null;
    try {
      const mod = await import('expo-iap');
      await mod.initConnection();
      return mod;
    } catch {
      return null;
    }
  })();
  return iapPromise;
}

/** Store price for the product, e.g. "₹2,500.00", or null if the store isn't available. */
export async function storePrice(): Promise<string | null> {
  const m = await iap();
  if (!m) return null;
  try {
    const products = await m.fetchProducts({ skus: [PREMIUM_SKU], type: 'in-app' });
    return (products as { displayPrice: string }[] | null)?.[0]?.displayPrice ?? null;
  } catch {
    return null;
  }
}

/**
 * Starts the purchase and resolves when the store reports the result.
 * Returns 'purchased', 'cancelled' or an error message.
 */
export async function buyPremium(): Promise<'purchased' | 'cancelled' | 'unavailable' | string> {
  const m = await iap();
  if (!m) return 'unavailable';
  return new Promise((resolve) => {
    const ok = m.purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== PREMIUM_SKU || purchase.purchaseState !== 'purchased') return;
      await m.finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      ok.remove();
      fail.remove();
      resolve('purchased');
    });
    const fail = m.purchaseErrorListener((error) => {
      ok.remove();
      fail.remove();
      resolve(/cancel/i.test(String(error.code ?? error.message)) ? 'cancelled' : error.message || 'Purchase failed');
    });
    m.requestPurchase({ request: { apple: { sku: PREMIUM_SKU }, google: { skus: [PREMIUM_SKU] } }, type: 'in-app' }).catch((e: Error) => {
      ok.remove();
      fail.remove();
      resolve(e.message || 'Purchase failed');
    });
  });
}

/** True when this store account already owns Premium (reinstall / new phone). */
export async function restorePremium(): Promise<boolean | null> {
  const m = await iap();
  if (!m) return null;
  try {
    const owned = await m.getAvailablePurchases();
    return !!(owned as { productId: string }[] | null)?.some((p) => p.productId === PREMIUM_SKU);
  } catch {
    return null;
  }
}
