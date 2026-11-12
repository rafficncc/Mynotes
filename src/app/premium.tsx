import { ask } from '../components/Dialog';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, Icon, Row, Screen, styles } from '../components/ui';
import { CURRENCIES, FREE_LIMITS, PREMIUM_PRICE_INR, currencyInfo, premiumPrice } from '../logic/region';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const PERKS: [string, string, string][] = [
  ['infinite-outline', 'Unlimited accounts & cards', `Free plan: ${FREE_LIMITS.accounts} accounts and ${FREE_LIMITS.creditCards} credit cards.`],
  ['people-outline', 'Family group', 'Everyone logs spends against their own allowance.'],
  ['cloud-upload-outline', 'Google Drive backup', 'Back up and restore on a new phone.'],
  ['notifications-outline', 'All reminders', 'Bills, EMIs, card dues and document expiries.'],
  ['heart-outline', 'One payment, forever', 'No subscription. All future updates included.'],
];

export default function Premium() {
  const settings = useStore((s) => s.settings);
  const accounts = useStore((s) => s.accounts);
  const updateSettings = useStore((s) => s.updateSettings);
  const price = premiumPrice(settings.currencyCode);
  const c = currencyInfo(settings.currencyCode);
  const active = accounts.filter((a) => !a.archived);
  const cards = active.filter((a) => a.type === 'credit_card').length;
  const others = active.length - cards;

  const buy = () =>
    ask(
      'Store payment not connected yet',
      'Google Play / App Store billing is added before the app is published. For testing, you can unlock Premium on this device now.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlock for testing', onPress: () => { updateSettings({ premium: true }); router.back(); } },
      ],
    );

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <View style={{ backgroundColor: colors.accent, padding: 14, borderRadius: 20 }}>
          <Icon name="diamond" size={34} color="#fff" />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>FamilyFin Premium</Text>
        <Text style={[styles.itemSub, { fontSize: 14 }]}>Lifetime access for the whole family</Text>
      </View>

      {settings.premium ? (
        <Card style={{ backgroundColor: colors.successSoft }}>
          <Row>
            <Icon name="checkmark-circle" color={colors.success} size={24} />
            <Text style={[styles.itemTitle, { color: colors.success, flex: 1 }]}>Premium is active on this device</Text>
          </Row>
        </Card>
      ) : (
        <Card>
          <Text style={styles.itemSub}>
            You are using {others}/{FREE_LIMITS.accounts} accounts and {cards}/{FREE_LIMITS.creditCards} credit cards on the free plan.
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

      <Card style={{ alignItems: 'center' }}>
        <Text style={styles.itemSub}>One-time price in {c.name}</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>{price.label}</Text>
        <Text style={styles.hint}>Same value as ₹{PREMIUM_PRICE_INR.toLocaleString('en-IN')} everywhere. The store shows the final local price and taxes.</Text>
      </Card>

      {!settings.premium ? <Button title={`Get lifetime Premium · ${price.label}`} icon="diamond-outline" onPress={buy} /> : (
        <Button title="Turn off Premium (testing)" variant="secondary" onPress={() => updateSettings({ premium: false })} />
      )}

      <Card>
        <Text style={styles.label}>Price in other regions</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CURRENCIES.map((x) => (
            <Text key={x.code} style={[styles.itemSub, { width: '47%' }]}>
              {x.code}: {premiumPrice(x.code).label}
            </Text>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
