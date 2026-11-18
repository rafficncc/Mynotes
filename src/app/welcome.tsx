import { router } from 'expo-router';
import { useState } from 'react';
import { ask } from '../components/Dialog';
import { changeLanguage, lang, LANGUAGES, t } from '../i18n';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleConnectButton } from '../components/GoogleBackup';
import { Button, Card, Chip, ChipRow, Icon, Screen, styles } from '../components/ui';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const FEATURES: [string, string, string][] = [
  ['wallet-outline', 'Every rupee, every mode', 'Cash, bank, debit & credit cards, UPI wallets and transfers between them.'],
  ['card-outline', 'Smart Card picker', 'Tells you which credit card to swipe today for the most interest-free days.'],
  ['bulb-outline', 'Savings coach', 'Finds where money leaks and suggests how to cut it – with ₹ amounts.'],
  ['people-outline', 'Built for families', 'Allowance per member, family group, bills, EMIs and goals.'],
  ['checkbox-outline', 'Never miss a due date', 'Reminders for bills, EMIs, card dues and passport/visa expiry.'],
  ['lock-closed-outline', 'Private by design', 'No bank login, no SMS reading. Data stays on your phone; optional backup to your own Google Drive.'],
];

export default function Welcome() {
  const loadDemo = useStore((s) => s.loadDemo);

  const [, rerender] = useState(0);
  // Guided first-time setup: salary account, salary day, cash, cards, rent.
  const start = () => router.push('/setup');
  const demo = () => {
    loadDemo();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <ChipRow>
          {LANGUAGES.filter((l) => l.key !== 'auto').map((l) => (
            <Chip
              key={l.key}
              label={l.label}
              selected={lang === l.key}
              onPress={() => {
                if (changeLanguage(l.key)) ask(t('Close and reopen FamilyFin to apply.'));
                rerender((n) => n + 1);
              }}
            />
          ))}
        </ChipRow>
        <View style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
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
        <GoogleConnectButton onSignedIn={start} />
        <Button title={t('Set up my accounts')} icon="arrow-forward" onPress={start} />
        <Button title={t('Explore with demo data')} variant="secondary" icon="play-outline" onPress={demo} />
        <Text style={[styles.hint, { textAlign: 'center' }]}>You can clear demo data any time from Settings.</Text>
      </Screen>
    </SafeAreaView>
  );
}
