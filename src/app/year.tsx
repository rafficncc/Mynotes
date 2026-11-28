import { premiumOnly } from '../components/PremiumGate';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Share, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, DonutChart, HBars } from '../components/charts';
import { GradientBg, HERO } from '../components/GradientBg';
import { expenses, monthlyTotals, spendByCategory, spendByMember, spendByMerchant } from '../logic/analytics';
import { computeBalances, computeNetWorth } from '../logic/balances';
import { captureRef } from 'react-native-view-shot';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Icon, Screen, SectionTitle } from '../components/ui';
import { monthLabel, toISODate } from '../logic/dates';
import { yearReview } from '../logic/reports';
import { savingsThisYear } from '../logic/savings';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

function Year() {
  const data = useAppData();
  const { money, compact } = useMoney();
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear());
  const r = yearReview(data, year, now);
  const meter = savingsThisYear(data, year < now.getFullYear() ? new Date(year, 11, 31) : now);
  const card = useRef<ComponentRef<typeof View>>(null);

  const { width } = useWindowDimensions();
  const w = Math.min(width, 720) - 64;
  const list = data.transactions.filter((t) => t.date.startsWith(String(year)));
  const months = monthlyTotals(data.transactions, `${year}-12`, 12, 1);
  const best = [...months].filter((m) => m.income > 0).sort((x, y) => y.income - y.expense - (x.income - x.expense))[0];
  const end = year < now.getFullYear() ? `${year}-12-31` : toISODate(now);
  const nwAt = (date: string) => computeNetWorth(data.accounts, computeBalances(data.accounts, data.transactions.filter((t) => t.date <= date))).net;
  const nwStart = nwAt(`${year - 1}-12-31`);
  const nwEnd = nwAt(end);
  const shops = spendByMerchant(expenses(list), 5);
  const members = spendByMember(list, data.members);

  const facts: [string, string, string][] = [
    ...(r.topCategory ? [['pie-chart', 'Biggest category', `${r.topCategory.label} · ${money(r.topCategory.value)}`] as [string, string, string]] : []),
    ...(r.topMerchant ? [['storefront', 'Favourite shop', `${r.topMerchant.merchant} · ${r.topMerchant.count} visit${r.topMerchant.count === 1 ? "" : "s"}`] as [string, string, string]] : []),
    ...(r.cheapestMonth ? [['leaf', 'Thriftiest month', `${monthLabel(r.cheapestMonth.key)} · ${money(r.cheapestMonth.total)}`] as [string, string, string]] : []),
    ...(best ? [['trophy', 'Best saving month', `${monthLabel(best.key)} · kept ${money(best.income - best.expense)}`] as [string, string, string]] : []),
    ...(r.biggest ? [['cart', 'Biggest spend', `${r.biggest.merchant ?? r.biggest.note ?? 'Purchase'} · ${money(r.biggest.amount)}`] as [string, string, string]] : []),
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

      {/* The shareable card */}
      <View ref={card} collapsable={false} style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: HERO[0] }}>
        <GradientBg id="yearbg" />
        <View pointerEvents="none" style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#ffffff10', top: -100, right: -90 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#ffffff0a', bottom: -60, left: -50 }} />
        <View style={{ padding: 22, gap: 14 }}>
          <Text style={{ color: '#ffffffb3', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>FAMILYFIN · YEAR IN REVIEW</Text>
          <Text style={{ color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: -1, lineHeight: 56 }}>{year}</Text>
          {meter.total > 0 ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFD97833', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: '#FFD978', fontWeight: '900' }}>✨ FamilyFin saved you {money(meter.total)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {(
              [
                ['Earned', money(r.earned), '#7EE3B5'],
                ['Spent', money(r.spent), '#FF9E8A'],
                ['Saved', `${money(Math.max(0, r.saved))} · ${r.savingsRate}%`, '#FFD978'],
                ['No-splurge days', `${r.noSpendDays} days`, '#9CC3FF'],
              ] as const
            ).map(([label, value, c]) => (
              <View key={label} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: '#ffffff14', borderRadius: 14, padding: 12 }}>
                <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{label}</Text>
                <Text style={{ color: c, fontSize: 17, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
              </View>
            ))}
          </View>
          <View style={{ backgroundColor: '#00000026', borderRadius: 14, padding: 12, gap: 6 }}>
            <Text style={{ color: '#ffffffb3', fontSize: 12 }}>Net worth {nwEnd >= nwStart ? 'grew' : 'fell'} by</Text>
            <Text style={{ color: nwEnd >= nwStart ? '#7EE3B5' : '#FF9E8A', fontSize: 22, fontWeight: '900' }}>{money(Math.abs(nwEnd - nwStart))}</Text>
            <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{money(nwStart)} → {money(nwEnd)}</Text>
          </View>
          {facts.map(([icon, label, value]) => (
            <View key={label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ backgroundColor: '#ffffff1f', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} color="#FFD978" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffffaa', fontSize: 12 }}>{label}</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{value}</Text>
              </View>
            </View>
          ))}
          <Text style={{ color: '#ffffff99', fontSize: 11 }}>
            {r.transactions} entries tracked{r.billsScanned ? ` · ${r.billsScanned} bills scanned` : ''} · made with FamilyFin
          </Text>
        </View>
      </View>
      {data.settings.hideAmounts ? <Text style={{ color: colors.muted, fontSize: 12 }}>Amounts are hidden. Turn off “Hide amounts” to share real numbers.</Text> : null}
      <Button title="Share my year" icon="share-social-outline" onPress={share} />

      <SectionTitle title="Month by month" />
      <Card>
        <BarChart width={w} height={170} labels={months.map((m) => monthLabel(m.key).slice(0, 1))} series={[{ name: 'Earned', color: colors.success, values: months.map((m) => m.income) }, { name: 'Spent', color: colors.danger, values: months.map((m) => m.expense) }]} format={compact} />
      </Card>

      {r.topCategory ? (
        <>
          <SectionTitle title="Where the money went" />
          <Card>
            <DonutChart data={spendByCategory(list, data.categories)} centerLabel={String(year)} centerValue={compact(r.spent)} format={money} maxSlices={5} />
          </Card>
        </>
      ) : null}

      {shops.length ? (
        <>
          <SectionTitle title="Top shops" />
          <Card>
            <HBars rows={shops.map((m) => ({ label: m.merchant, value: m.total, sub: `${m.count}×`, color: colors.info }))} format={money} />
          </Card>
        </>
      ) : null}

      {members.length > 1 ? (
        <>
          <SectionTitle title="Family members" />
          <Card>
            <HBars rows={members.map((m) => ({ label: m.name, value: m.total, color: colors.primary }))} format={money} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

export default premiumOnly(Year, 'Year in review', 'Your family’s year in one card, including how much FamilyFin saved you.');
