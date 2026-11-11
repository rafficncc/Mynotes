import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Icon, Screen, styles } from '../components/ui';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const FEATURES: [string, string, string][] = [
  ['wallet-outline', 'Every rupee, every mode', 'Cash, bank, debit & credit cards, UPI wallets and transfers between them.'],
  ['card-outline', 'Smart Card picker', 'Tells you which credit card to swipe today for the most interest-free days.'],
  ['bulb-outline', 'Savings coach', 'Finds where money leaks and suggests how to cut it – with ₹ amounts.'],
  ['storefront-outline', 'Cheaper shop finder', 'Compares prices across shops so you buy the same thing for less.'],
  ['people-outline', 'Built for families', 'Track spends per member, budgets, bills and family goals.'],
  ['lock-closed-outline', 'Private by design', 'No bank login, no SMS reading. Your data stays on your phone.'],
];

export default function Welcome() {
  const loadDemo = useStore((s) => s.loadDemo);
  const updateSettings = useStore((s) => s.updateSettings);

  const start = () => {
    updateSettings({ onboarded: true });
    router.replace('/');
    router.push('/accounts');
  };
  const demo = () => {
    loadDemo();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 24 }}>
          <View style={{ backgroundColor: colors.primary, padding: 18, borderRadius: 24 }}>
            <Icon name="home" size={40} color="#fff" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>FamilyFin</Text>
          <Text style={[styles.itemSub, { textAlign: 'center', fontSize: 14 }]}>
            The money coach for every family. Track, understand and cut your expenses.
          </Text>
        </View>
        <Card>
          {FEATURES.map(([icon, title, text]) => (
            <View key={title} style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
              <Icon name={icon} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemSub}>{text}</Text>
              </View>
            </View>
          ))}
        </Card>
        <Button title="Set up my accounts" icon="arrow-forward" onPress={start} />
        <Button title="Explore with demo data" variant="secondary" icon="play-outline" onPress={demo} />
        <Text style={[styles.hint, { textAlign: 'center' }]}>You can clear demo data any time from Settings.</Text>
      </Screen>
    </SafeAreaView>
  );
}
