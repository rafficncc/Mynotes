import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Icon, Row, Screen, styles } from '../components/ui';
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
const allowTestUnlock = Constants.expoConfig?.extra?.allowTestUnlock !== false;

export default function Premium() {
  const settings = useStore((s) => s.settings);
  const accounts = useStore((s) => s.accounts);
  const updateSettings = useStore((s) => s.updateSettings);
  const [prices, setPrices] = useState<StorePrices | null>(null);
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    storePrices().then(setPrices);
  }, []);

  // Google Play's price in the buyer's own currency; an estimate only where the store isn't available.
  const label = (p: Plan) => (p === 'yearly' ? prices?.yearly : prices?.lifetime) ?? `≈ ${premiumPrice(settings.currencyCode, p).label}`;

  const unlock = (p: Plan) => {
    updateSettings({ premium: true, premiumPlan: p });
    router.back();
  };

  const buy = async () => {
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
    ask('Purchase failed', result);
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
        <View style={{ backgroundColor: colors.accent, padding: 14, borderRadius: 20 }}>
          <Icon name="diamond" size={34} color="#fff" />
        </View>
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
