import { Platform } from 'react-native';

/**
 * Premium via Google Play Billing / App Store (expo-iap). Two products, created in Play Console:
 * - familyfin_premium_lifetime: one-time product (₹1,999 in India; Play sets local prices elsewhere)
 * - familyfin_premium_yearly: subscription, base plan "yearly" (₹499/year), optional 7-day free-trial offer
 * shortcut: purchases are trusted on the device; add server-side receipt checks if piracy matters.
 */
export const LIFETIME_SKU = 'familyfin_premium_lifetime';
export const YEARLY_SKU = 'familyfin_premium_yearly';
export type Plan = 'lifetime' | 'yearly';
const SKU: Record<Plan, string> = { lifetime: LIFETIME_SKU, yearly: YEARLY_SKU };

type Iap = typeof import('expo-iap');
type Offer = { offerTokenAndroid?: string | null; paymentMode?: string | null };
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

/** The yearly plan's free-trial offer if this user is eligible, else its regular offer. */
let yearlyOffer: Offer | undefined;

export interface StorePrices {
  /** Local prices as Google Play shows them, e.g. "₹1,999.00", "AED 89.99". */
  lifetime?: string;
  yearly?: string;
  /** True when Play offers this user a free trial on the yearly plan. */
  trial: boolean;
}

/** Prices in the buyer's own Google Play currency, or null if the store isn't available. */
export async function storePrices(): Promise<StorePrices | null> {
  const m = await iap();
  if (!m) return null;
  try {
    const [inapp, subs] = await Promise.all([
      m.fetchProducts({ skus: [LIFETIME_SKU], type: 'in-app' }).catch(() => null),
      m.fetchProducts({ skus: [YEARLY_SKU], type: 'subs' }).catch(() => null),
    ]);
    const life = (inapp as { displayPrice: string }[] | null)?.[0];
    const year = (subs as { displayPrice: string; subscriptionOffers?: Offer[] }[] | null)?.[0];
    const offers = (year?.subscriptionOffers ?? []).filter((o) => o.offerTokenAndroid);
    yearlyOffer = offers.find((o) => o.paymentMode === 'free-trial') ?? offers[0];
    return { lifetime: life?.displayPrice, yearly: year?.displayPrice, trial: yearlyOffer?.paymentMode === 'free-trial' };
  } catch {
    return null;
  }
}

/** Starts the purchase; resolves 'purchased', 'cancelled', 'unavailable' or an error message. */
export async function buyPremium(plan: Plan): Promise<'purchased' | 'cancelled' | 'unavailable' | string> {
  const m = await iap();
  if (!m) return 'unavailable';
  if (plan === 'yearly' && Platform.OS === 'android' && !yearlyOffer) await storePrices();
  return new Promise((resolve) => {
    const done = (r: string) => {
      ok.remove();
      fail.remove();
      resolve(r);
    };
    const ok = m.purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== SKU[plan] || purchase.purchaseState !== 'purchased') return;
      await m.finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      done('purchased');
    });
    const fail = m.purchaseErrorListener((error) => done(/cancel/i.test(String(error.code ?? error.message)) ? 'cancelled' : error.message || 'Purchase failed'));
    const request =
      plan === 'lifetime'
        ? m.requestPurchase({ request: { apple: { sku: LIFETIME_SKU }, google: { skus: [LIFETIME_SKU] } }, type: 'in-app' })
        : m.requestPurchase({
            request: {
              apple: { sku: YEARLY_SKU },
              google: { skus: [YEARLY_SKU], subscriptionOffers: yearlyOffer?.offerTokenAndroid ? [{ sku: YEARLY_SKU, offerToken: yearlyOffer.offerTokenAndroid }] : [] },
            },
            type: 'subs',
          });
    request.catch((e: Error) => done(e.message || 'Purchase failed'));
  });
}

/** Which plan this store account owns now (an expired yearly plan is not listed), or null if the store isn't available. */
export async function ownedPlan(): Promise<Plan | 'none' | null> {
  const m = await iap();
  if (!m) return null;
  try {
    const owned = ((await m.getAvailablePurchases()) as { productId: string }[] | null) ?? [];
    if (owned.some((p) => p.productId === LIFETIME_SKU)) return 'lifetime';
    if (owned.some((p) => p.productId === YEARLY_SKU)) return 'yearly';
    return 'none';
  } catch {
    return null;
  }
}
