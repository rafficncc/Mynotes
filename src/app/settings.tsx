import { router } from 'expo-router';
import { Alert, Share, Switch, Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Row, Screen, SectionTitle, styles } from '../components/ui';
import { transactionsToCsv } from '../logic/csv';
import { useAppData } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const CURRENCIES = [
  { symbol: '₹', locale: 'en-IN' },
  { symbol: '$', locale: 'en-US' },
  { symbol: '€', locale: 'de-DE' },
  { symbol: '£', locale: 'en-GB' },
  { symbol: 'AED ', locale: 'en-AE' },
  { symbol: 'SAR ', locale: 'en-SA' },
];

export default function Settings() {
  const data = useAppData();
  const { updateSettings, loadDemo, resetAll } = useStore();

  const exportCsv = async () => {
    try {
      await Share.share({ title: 'FamilyFin transactions', message: transactionsToCsv(data) });
    } catch {
      Alert.alert('Could not share the export');
    }
  };

  const backup = async () => {
    try {
      await Share.share({ title: 'FamilyFin backup', message: JSON.stringify(data) });
    } catch {
      Alert.alert('Could not share the backup');
    }
  };

  return (
    <Screen>
      <SectionTitle title="Currency" />
      <ChipRow>
        {CURRENCIES.map((c) => (
          <Chip key={c.symbol} label={c.symbol.trim()} selected={data.settings.currency === c.symbol} onPress={() => updateSettings({ currency: c.symbol, locale: c.locale })} />
        ))}
      </ChipRow>

      <SectionTitle title="Credit card advice" />
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>I always pay card bills in full</Text>
            <Text style={styles.itemSub}>
              Turn on to get tips on using credit cards for interest-free float. Turn off if you carry a balance – then paying by debit/UPI is safer.
            </Text>
          </View>
          <Switch
            value={data.settings.payCardsInFull}
            onValueChange={(v) => updateSettings({ payCardsInFull: v })}
            trackColor={{ true: colors.primary }}
          />
        </Row>
      </Card>

      <SectionTitle title="Your data" />
      <Card>
        <Text style={styles.itemSub}>
          {data.transactions.length} transactions · {data.accounts.length} accounts. Everything is stored only on this phone.
        </Text>
        <Button title="Export transactions (CSV)" variant="secondary" icon="download-outline" onPress={exportCsv} />
        <Button title="Share full backup (JSON)" variant="secondary" icon="cloud-upload-outline" onPress={backup} />
      </Card>

      <SectionTitle title="Demo & reset" />
      <Card>
        <Button
          title="Load demo data"
          variant="secondary"
          icon="play-outline"
          onPress={() =>
            Alert.alert('Load demo data?', 'This replaces everything in the app with sample family data.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Load', onPress: () => { loadDemo(); router.replace('/'); } },
            ])
          }
        />
        <Button
          title="Erase all data"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            Alert.alert('Erase everything?', 'All accounts, transactions, budgets and goals will be deleted. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => { resetAll(); router.replace('/'); } },
            ])
          }
        />
      </Card>
      <Text style={[styles.hint, { textAlign: 'center' }]}>FamilyFin v1.0 · Made for families</Text>
    </Screen>
  );
}
