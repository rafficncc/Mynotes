import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
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
  ['trending-up-outline', 'Investments, gold & insurance', 'FDs, SIPs, gold, policies, claims and net worth trend.'],
  ['document-text-outline', 'Reports & year in review', 'Any dates, month comparison, PDF sharing.'],
  ['airplane-outline', 'Money sent home, trips & vehicles', 'Remittances, events, fuel and challenges.'],
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
      return ask('This plan isn’t available yet', 'It will appear once it is active on Google Play. Please choose the other plan or try again later.');
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
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        {/* Tapping the icon 7 times opens the developer code box. */}
        <Pressable onPress={() => setTaps((n) => n + 1)} accessible={false} style={{ backgroundColor: colors.accent, padding: 14, borderRadius: 20 }}>
          <Icon name="diamond" size={34} color="#fff" />
        </Pressable>
        {taps >= 7 && !settings.premium ? (
          <Row style={{ alignSelf: 'stretch' }}>
            <View style={{ flex: 1 }}><Field label="" value={devCode} onChangeText={setDevCode} placeholder="Developer code" autoCapitalize="characters" /></View>
            <Button title="Unlock" variant="secondary" onPress={devUnlock} />
          </Row>
        ) : null}
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>FamilyFin Premium</Text>
        <Text style={[styles.itemSub, { fontSize: 14 }]}>One plan covers your whole family on this phone</Text>
      </View>

      {settings.premium ? (
        <Card style={{ backgroundColor: colors.successSoft }}>
          <Row>
            <Icon name="checkmark-circle" color={colors.success} size={24} />
            <Text style={[styles.itemTitle, { color: colors.success, flex: 1 }]}>
              Premium is active{settings.premiumPlan === 'yearly' ? ' (yearly plan)' : settings.premiumPlan === 'lifetime' ? ' (lifetime)' : ''}
            </Text>
          </Row>
          {settings.premiumPlan === 'yearly' ? <Text style={styles.hint}>Manage or cancel in Google Play → Payments & subscriptions.</Text> : null}
        </Card>
      ) : (
        <Card>
          <Text style={styles.itemSub}>
            Free plan use: {LIMIT_CATEGORIES.map((c) => `${limitUsage(accounts, c.key)}/${FREE_PER_CATEGORY} ${c.label}`).join(' · ')}.
          </Text>
        </Card>
      )}

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
