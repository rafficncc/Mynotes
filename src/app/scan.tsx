import { router } from 'expo-router';
import { t } from '../i18n';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, Card, Icon, Screen, styles } from '../components/ui';
import { currencyInfo } from '../logic/region';
import { scanBill, ScanError, type ScanSource } from '../services/scanReceipt';
import { setScanDraft } from '../store/scanDraft';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const TIPS = [
  'Lay the bill flat on a dark surface, in good light.',
  'Fit the whole bill in the photo; on Android you can crop after taking it.',
  'Long bill? Make sure the Total part is clearly visible.',
];

export default function Scan() {
  const transactions = useStore((s) => s.transactions);
  const currencyCode = useStore((s) => s.settings.currencyCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (source: ScanSource) => {
    setError(null);
    setBusy(true);
    try {
      const result = await scanBill(source, { history: transactions, monthFirst: currencyInfo(currencyCode).region === 'US' });
      if (!result) return;
      if (!result.receipt.total && !result.receipt.merchant) {
        setError('Could not read this bill. Try again closer, flatter and in better light, or enter it by hand.');
        return;
      }
      setScanDraft(result);
      router.replace('/add?type=expense&scanned=1');
    } catch (e) {
      setError(e instanceof ScanError ? e.message : 'Something went wrong while reading the bill. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
        <View style={{ backgroundColor: colors.primarySoft, padding: 16, borderRadius: 40 }}>
          <Icon name="scan-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{t('Scan a bill')}</Text>
        <Text style={[styles.itemSub, { textAlign: 'center' }]}>
          FamilyFin reads the shop, date and total and fills in the expense for you. The photo is read on your phone and never uploaded.
        </Text>
      </Card>
      {busy ? (
        <Card style={{ alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.itemSub}>{t('Reading the bill…')}</Text>
        </Card>
      ) : (
        <>
          <Button title={t('Take a photo')} icon="camera-outline" onPress={() => run('camera')} />
          <Button title={t('Choose from gallery')} variant="secondary" icon="images-outline" onPress={() => run('library')} />
        </>
      )}
      {error ? (
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <Text style={[styles.insightText, { color: colors.danger }]}>{error}</Text>
        </Card>
      ) : null}
      <Card>
        <Text style={styles.label}>For best results</Text>
        {TIPS.map((t) => (
          <Text key={t} style={styles.itemSub}>• {t}</Text>
        ))}
      </Card>
      <Button title={t('Enter it by hand instead')} variant="secondary" icon="create-outline" onPress={() => router.replace('/add?type=expense')} />
    </Screen>
  );
}
