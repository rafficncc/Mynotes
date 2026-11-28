import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { GradientBg } from '../components/GradientBg';
import { Button, Card, Field, Icon, Row, Screen, styles } from '../components/ui';
import * as Crypto from 'expo-crypto';
import { FREE_PER_CATEGORY, LIMIT_CATEGORIES, limitUsage, premiumPrice } from '../logic/region';
import { FREE_MONTHLY } from '../logic/premium';
import { buyPremium, ownedPlan, storePrices, type Plan, type StorePrices } from '../services/purchases';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const PERKS: [string, string, string][] = [
  ['infinite-outline', 'Unlimited accounts & cards', `Free plan: ${FREE_PER_CATEGORY} in each category.`],
  ['scan-outline', 'Unlimited bill scans & voice entry', `Free plan: ${FREE_MONTHLY} of each a month.`],
  ['people-outline', 'Family group', 'Everyone logs spends against their own allowance.'],
  ['shield-checkmark-outline', 'Money Vault for your family', 'Keep accounts, nominees and contacts ready for your loved ones.'],
  ['trending-up-outline', 'Investments, gold & insurance', 'Mutual funds, SIPs, stocks, FDs, PPF, gold, policies and net worth trend.'],
  ['document-text-outline', 'Reports & year in review', 'Any dates, month comparison, PDF sharing.'],
  ['airplane-outline', 'Money sent home & trips', 'Remittances, events and challenges.'],
];

/** Test builds can unlock Premium without paying; app.config.js turns this off for production (store) builds. */
const DEV_CODE_HASH = '0c5d20d6c9bc7136f6df2d40d48127ac8fdafdb4b12903132f7074f91ea025a7';

const allowTestUnlock = Constants.expoConfig?.extra?.allowTestUnlock !== false;

export default function Premium() {
  const settings = useStore((s) => s.settings);
  const accounts = useStore((s) => s.accounts);
  const updateSettings = useStore((s) => s.updateSettings);
  const [prices, setPrices] = useState<StorePrices | null>(null);
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  const [taps, setTaps] = useState(0);
  const [devCode, setDevCode] = useState('');

  // Only the SHA-256 of the code ships in the app, so the code can't be read from it.
  // shortcut: a determined person could patch the app to skip this; fine for a developer unlock.
  const devUnlock = async () => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `familyfin-dev:${devCode.trim().toUpperCase()}`);
    if (hash !== DEV_CODE_HASH) return ask('Wrong code');
    updateSettings({ premium: true, premiumPlan: undefined });
    ask('Premium unlocked', 'Developer access is on for this phone.');
    router.back();
  };
  useEffect(() => {
    storePrices().then(setPrices);
  }, []);

  // Google Play's price in the buyer's own currency; an estimate only where the store isn't available.
  const label = (p: Plan) => {
    const store = p === 'yearly' ? prices?.yearly : prices?.lifetime;
    if (store) return store;
    // Store reachable but this product isn't live in Play yet
    return prices ? 'Coming soon' : `≈ ${premiumPrice(settings.currencyCode, p).label}`;
  };

  const unlock = (p: Plan) => {
    updateSettings({ premium: true, premiumPlan: p });
    router.back();
  };

  const buy = async () => {
    if (prices && !(plan === 'yearly' ? prices.yearly : prices.lifetime)) {
      return ask('This plan isn’t available yet', 'This plan isn’t on sale in your country yet. Please choose the other plan or try again later.');
    }
    setBusy(true);
    const result = await buyPremium(plan);
    setBusy(false);
    if (result === 'purchased') {
      unlock(plan);
      return ask('Thank you!', 'Premium is now active on this phone.');
    }
    if (result === 'cancelled') return;
    if (result === 'unavailable') {
      // Store billing only works in builds installed from Google Play / TestFlight.
      return ask(
        'Store payment not available here',
        'Purchases work in the app installed from Google Play or TestFlight.' + (allowTestUnlock ? ' For testing, you can unlock Premium on this phone.' : ''),
        allowTestUnlock ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Unlock for testing', onPress: () => unlock(plan) }] : undefined,
      );
    }
    ask('Purchase failed', /query the product/i.test(result) ? 'Google Play couldn’t find this plan. Please try again later.' : result);
  };

  const restore = async () => {
    setBusy(true);
    const owned = await ownedPlan();
    setBusy(false);
    if (owned === 'lifetime' || owned === 'yearly') return unlock(owned);
    ask(owned === null ? 'Store not available' : 'No purchase found', owned === null ? 'Open the app installed from Google Play or the App Store to restore.' : 'This store account has no active Premium plan.');
  };

  const planCard = (p: Plan, title: string, sub: string) => (
    <Pressable key={p} onPress={() => setPlan(p)} accessibilityRole="radio" accessibilityState={{ selected: plan === p }} style={{ flex: 1 }}>
      <Card style={{ flex: 1, alignItems: 'center', gap: 4, borderWidth: 2, borderColor: plan === p ? colors.primary : 'transparent' }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{label(p)}</Text>
        <Text style={[styles.hint, { textAlign: 'center' }]}>{sub}</Text>
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      {/* Hero in the app's gradient with a gold diamond. Tapping the diamond 7 times opens the developer code box. */}
      <View style={{ borderRadius: 24, overflow: 'hidden' }}>
        <GradientBg id="prembg" colors={['#141A4A', '#3B2275', '#7A5A12']} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFD97814', top: -90, right: -70 }} />
        <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => setTaps((n) => n + 1)} accessible={false} style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <GradientBg id="premdiamond" colors={['#FFE7A0', '#F5B841', '#D98E04']} />
            <Icon name="diamond" size={34} color="#5A3E00" />
          </Pressable>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff' }}>FamilyFin Premium</Text>
          <Text style={{ color: '#ffffffcc', fontSize: 14, textAlign: 'center' }}>One plan covers your whole family on this phone</Text>
          {settings.premium ? (
            <View style={{ backgroundColor: '#7EE3B533', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="checkmark-circle" color="#7EE3B5" size={18} />
              <Text style={{ color: '#7EE3B5', fontWeight: '900' }}>
                Premium is active{settings.premiumPlan === 'yearly' ? ' · yearly' : settings.premiumPlan === 'lifetime' ? ' · lifetime' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {taps >= 7 && !settings.premium ? (
        <Row>
          <View style={{ flex: 1 }}><Field label="" value={devCode} onChangeText={setDevCode} placeholder="Developer code" autoCapitalize="characters" /></View>
          <Button title="Unlock" variant="secondary" onPress={devUnlock} />
        </Row>
      ) : null}
      {settings.premium && settings.premiumPlan === 'yearly' ? <Text style={[styles.hint, { textAlign: 'center' }]}>Manage or cancel in Google Play → Payments & subscriptions.</Text> : null}

      {!settings.premium ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.itemTitle}>Your free plan</Text>
          {LIMIT_CATEGORIES.map((c) => {
            const used = limitUsage(accounts, c.key);
            const full = used >= FREE_PER_CATEGORY;
            return (
              <View key={c.key} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={styles.insightText}>{c.label[0].toUpperCase() + c.label.slice(1)}</Text>
                  <Text style={{ fontWeight: '800', color: full ? colors.warning : colors.text }}>
                    {Math.min(used, FREE_PER_CATEGORY)} of {FREE_PER_CATEGORY}{full ? ' · full' : ''}
                  </Text>
                </Row>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, (used / FREE_PER_CATEGORY) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: full ? colors.warning : colors.success }} />
                </View>
              </View>
            );
          })}
          <Text style={styles.hint}>Accounts you already have keep working. Premium removes the limit for new ones.</Text>
        </Card>
      ) : null}

      <Card>
        {PERKS.map(([icon, title, text]) => (
          <Row key={title} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
            <Icon name={icon} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{title}</Text>
              <Text style={styles.itemSub}>{text}</Text>
            </View>
          </Row>
        ))}
      </Card>

      {!settings.premium ? (
        <>
          <Row style={{ alignItems: 'stretch' }}>
            {planCard('yearly', 'Yearly', prices?.trial ? '7 days free, then per year. Cancel any time.' : 'Per year. Cancel any time.')}
            {planCard('lifetime', 'Lifetime', 'Pay once, yours forever.')}
          </Row>
          {!prices ? <Text style={[styles.hint, { textAlign: 'center' }]}>≈ estimate. Google Play shows the exact price in your currency before you pay.</Text> : null}
          <Button
            title={busy ? 'Please wait…' : plan === 'yearly' && prices?.trial ? 'Start 7-day free trial' : `Get ${plan === 'yearly' ? 'yearly' : 'lifetime'} Premium`}
            icon="diamond-outline"
            disabled={busy}
            onPress={buy}
          />
          <Button title="Restore purchase" variant="secondary" icon="refresh-outline" disabled={busy} onPress={restore} />
        </>
      ) : allowTestUnlock ? (
        <Button title="Turn off Premium (testing)" variant="secondary" onPress={() => updateSettings({ premium: false, premiumPlan: undefined })} />
      ) : null}
    </Screen>
  );
}
