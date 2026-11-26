import { premiumOnly } from '../components/PremiumGate';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ask } from '../components/Dialog';
import { Button, Chip, ChipRow, Icon, Screen } from '../components/ui';
import { formatDate, monthLabel } from '../logic/dates';
import { yearReview } from '../logic/reports';
import { savingsThisYear } from '../logic/savings';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

function Year() {
  const data = useAppData();
  const { money } = useMoney();
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear());
  const r = yearReview(data, year, now);
  const meter = savingsThisYear(data, year < now.getFullYear() ? new Date(year, 11, 31) : now);
  const card = useRef<ComponentRef<typeof View>>(null);

  const lines: [string, string, string][] = [
    ...(meter.total > 0 ? [['sparkles-outline', 'FamilyFin saved your family', money(meter.total)] as [string, string, string]] : []),
    ['wallet-outline', 'Spent', money(r.spent)],
    ['trending-up-outline', 'Saved', `${money(Math.max(0, r.saved))} (${r.savingsRate}% of income)`],
    ['flame-outline', 'No-splurge days', `${r.noSpendDays} days`],
    ...(r.topCategory ? [['pie-chart-outline', 'Biggest category', `${r.topCategory.label} · ${money(r.topCategory.value)}`] as [string, string, string]] : []),
    ...(r.topMerchant ? [['storefront-outline', 'Favourite shop', `${r.topMerchant.merchant} · ${r.topMerchant.count} visits`] as [string, string, string]] : []),
    ...(r.cheapestMonth ? [['leaf-outline', 'Thriftiest month', `${monthLabel(r.cheapestMonth.key)} · ${money(r.cheapestMonth.total)}`] as [string, string, string]] : []),
    ...(r.biggest ? [['cart-outline', 'Biggest spend', `${r.biggest.merchant ?? r.biggest.note ?? 'Purchase'} · ${money(r.biggest.amount)} on ${formatDate(r.biggest.date)}`] as [string, string, string]] : []),
  ];

  const share = async () => {
    try {
      if (Platform.OS !== 'web' && card.current && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(card, { format: 'png', quality: 1 });
        return await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your year' });
      }
      await Share.share({ message: `Our ${year} with FamilyFin: ${meter.total > 0 ? `FamilyFin saved us ${money(meter.total)}, ` : ''}saved ${r.savingsRate}% of income and had ${r.noSpendDays} no-splurge days! 💚` });
    } catch {
      ask('Could not share', 'Please try again.');
    }
  };

  return (
    <Screen>
      <ChipRow>
        {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
          <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
        ))}
      </ChipRow>
      <View ref={card} collapsable={false} style={{ backgroundColor: colors.primary, borderRadius: 24, padding: 24, gap: 14 }}>
        <Text style={{ color: '#ffffffcc', fontSize: 14, fontWeight: '600' }}>FAMILYFIN · YEAR IN REVIEW</Text>
        <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800' }}>{year}</Text>
        {lines.map(([icon, label, value]) => (
          <View key={label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#ffffff22', padding: 8, borderRadius: 20 }}>
              <Icon name={icon} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffffaa', fontSize: 12 }}>{label}</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{value}</Text>
            </View>
          </View>
        ))}
        <Text style={{ color: '#ffffffaa', fontSize: 12, marginTop: 6 }}>{r.transactions} transactions tracked{r.billsScanned ? ` · ${r.billsScanned} bills scanned` : ''}</Text>
      </View>
      {data.settings.hideAmounts ? <Text style={{ color: colors.muted, fontSize: 12 }}>Amounts are hidden. Turn off “Hide amounts” to share real numbers.</Text> : null}
      <Button title="Share" icon="share-social-outline" onPress={share} />
    </Screen>
  );
}

export default premiumOnly(Year, 'Year in review', 'Your family’s year in one card, including how much FamilyFin saved you.');
