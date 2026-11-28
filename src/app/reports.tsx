import { premiumOnly } from '../components/PremiumGate';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { AreaChart, BarChart, DonutChart, HBars } from '../components/charts';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Row, Screen, Stat, styles } from '../components/ui';
import { currentCycleKey, cycleBounds, formatDate, monthLabel, shiftMonthKey, toISODate } from '../logic/dates';
import { compareRanges, inRange, monthRange, netWorthHistory, rangeReport, reportHtml } from '../logic/reports';
import { monthlyTotals, savingsRates, spendByMember, spendByMerchant, spendByPaymentMode } from '../logic/analytics';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

type Preset = 'cycle' | 'last_cycle' | 'year' | 'last_year' | 'custom';

function Reports() {
  const data = useAppData();
  const { money, compact } = useMoney();
  const { width } = useWindowDimensions();
  const on = new Date();
  const sd = data.settings.cycleStartDay ?? 1;
  const [preset, setPreset] = useState<Preset>('cycle');
  const [from, setFrom] = useState(toISODate(new Date(on.getFullYear(), on.getMonth(), 1)));
  const [to, setTo] = useState(toISODate(on));
  const nowKey = toISODate(on).slice(0, 7);
  const [monthA, setMonthA] = useState(shiftMonthKey(nowKey, -1));
  const [monthB, setMonthB] = useState(nowKey);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const range = useMemo((): [string, string, string] => {
    const y = on.getFullYear();
    if (preset === 'cycle' || preset === 'last_cycle') {
      const key = preset === 'cycle' ? currentCycleKey(on, sd) : shiftMonthKey(currentCycleKey(on, sd), -1);
      const b = cycleBounds(key, sd);
      return [toISODate(b.start), toISODate(b.end), preset === 'cycle' ? 'This cycle' : 'Last cycle'];
    }
    if (preset === 'year') return [`${y}-01-01`, `${y}-12-31`, `Year ${y}`];
    if (preset === 'last_year') return [`${y - 1}-01-01`, `${y - 1}-12-31`, `Year ${y - 1}`];
    return [from, to, 'Custom range'];
  }, [preset, from, to, sd]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useMemo(() => rangeReport(data.transactions, data.categories, range[0], range[1]), [data, range]);
  const compare = useMemo(() => compareRanges(data.transactions, data.categories, monthRange(monthA), monthRange(monthB)), [data, monthA, monthB]);
  const history = useMemo(() => netWorthHistory(data.accounts, data.transactions, on, 12), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = Array.from({ length: 12 }, (_, i) => shiftMonthKey(nowKey, -i));
  const totalA = compare.reduce((s, r) => s + r.a, 0);
  const totalB = compare.reduce((s, r) => s + r.b, 0);

  const pdf = async () => {
    setBusy(true);
    try {
      const html = reportHtml(data, range[0], range[1], range[2], money);
      if (Platform.OS === 'web') return await Print.printAsync({ html });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share FamilyFin report', UTI: 'com.adobe.pdf' });
    } catch {
      ask('Could not create the PDF', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const w = Math.min(width, 720) - 64;
  const inR = inRange(data.transactions, range[0], range[1]);
  const trend = monthlyTotals(data.transactions, currentCycleKey(on, sd), 12, sd);
  const rates = savingsRates(trend);
  const top = compare.slice(0, 6);
  const maxChange = Math.max(1, ...compare.slice(0, 8).map((r) => Math.abs(r.change)));
  const nameA = `${monthLabel(monthA)} ${monthA.slice(2, 4)}`;
  const nameB = `${monthLabel(monthB)} ${monthB.slice(2, 4)}`;
  const diffPct = totalA ? Math.round(((totalB - totalA) / totalA) * 100) : null;

  return (
    <Screen>
      <ChipRow>
        {TABS.map(([k, l, icon]) => (
          <Chip key={k} label={l} icon={icon} selected={tab === k} onPress={() => setTab(k)} />
        ))}
      </ChipRow>

      {tab !== 'compare' && tab !== 'trends' && tab !== 'networth' ? (
        <>
          <ChipRow>
            {(
              [
                ['cycle', 'This cycle'],
                ['last_cycle', 'Last cycle'],
                ['year', 'This year'],
                ['last_year', 'Last year'],
                ['custom', 'Pick dates'],
              ] as [Preset, string][]
            ).map(([k, l]) => (
              <Chip key={k} label={l} selected={preset === k} onPress={() => setPreset(k)} />
            ))}
          </ChipRow>
          {preset === 'custom' ? (
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}><DateField label="From" value={from} onChange={setFrom} quick={false} /></View>
              <View style={{ flex: 1 }}><DateField label="To" value={to} onChange={setTo} quick={false} /></View>
            </Row>
          ) : null}
          <Card gradient>
            <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{range[2]} · {formatDate(range[0])} – {formatDate(range[1])} · {report.count} entries</Text>
            <Row>
              <Stat light label="Income" value={compact(report.income)} color={colors.success} />
              <Stat light label="Spent" value={compact(report.expense)} color={colors.danger} />
              <Stat light label="Saved" value={compact(report.saved)} color={colors.warning} />
            </Row>
            {report.income > 0 ? (
              <View style={{ gap: 4 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: '#ffffff26', overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(0, Math.min(100, (report.saved / report.income) * 100))}%`, height: '100%', backgroundColor: '#7EE3B5', borderRadius: 4 }} />
                </View>
                <Text style={{ color: '#ffffffd9', fontSize: 12, fontWeight: '700' }}>You kept {Math.round((report.saved / report.income) * 100)}% of income</Text>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {tab === 'overview' ? (
        <>
          <Card>
            <DonutChart data={report.byCategory} centerLabel="Spent" centerValue={compact(report.expense)} format={money} />
          </Card>
          <Button title={busy ? 'Preparing…' : 'Share this report as PDF'} icon="document-text-outline" disabled={busy} onPress={pdf} />
        </>
      ) : null}

      {tab === 'compare' ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.label}>First month</Text>
            <ChipRow>
              {months.slice(1, 7).map((m) => (
                <Chip key={m} label={`${monthLabel(m)} ${m.slice(2, 4)}`} selected={monthA === m} onPress={() => setMonthA(m)} />
              ))}
            </ChipRow>
            <Text style={styles.label}>Compare with</Text>
            <ChipRow>
              {months.slice(0, 6).map((m) => (
                <Chip key={m} label={`${monthLabel(m)} ${m.slice(2, 4)}`} selected={monthB === m} onPress={() => setMonthB(m)} />
              ))}
            </ChipRow>
          </Card>
          <Card gradient>
            <Row style={{ alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{nameA}</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{compact(totalA)}</Text>
              </View>
              <View style={{ alignItems: 'center', backgroundColor: '#ffffff1f', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: totalB > totalA ? '#FF9E8A' : '#7EE3B5', fontWeight: '900', fontSize: 16 }}>
                  {diffPct === null ? '→' : `${diffPct > 0 ? '▲' : '▼'} ${Math.abs(diffPct)}%`}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{nameB}</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{compact(totalB)}</Text>
              </View>
            </Row>
            <Text style={{ color: '#ffffffd9', fontSize: 12, textAlign: 'center' }}>
              {totalB > totalA ? `Spent ${money(totalB - totalA)} more` : totalB < totalA ? `Spent ${money(totalA - totalB)} less` : 'Same spending'}
            </Text>
          </Card>
          {top.length ? (
            <Card>
              <Text style={styles.itemTitle}>Top categories side by side</Text>
              <BarChart width={w} height={170} labels={top.map((r) => r.label.split(/[ &,]/)[0].slice(0, 8))} series={[{ name: nameA, color: '#9CC3FF', values: top.map((r) => r.a) }, { name: nameB, color: colors.primary, values: top.map((r) => r.b) }]} format={compact} />
            </Card>
          ) : null}
          <Card style={{ gap: 10 }}>
            <Text style={styles.itemTitle}>Biggest changes</Text>
            {compare.slice(0, 8).map((r) => {
              const up = r.change > 0;
              return (
                <View key={r.key} style={{ gap: 3 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={[styles.insightText, { flex: 1 }]} numberOfLines={1}>{r.label}</Text>
                    <Text style={{ fontWeight: '800', color: up ? colors.danger : colors.success }}>
                      {up ? '▲ +' : '▼ −'}{compact(Math.abs(r.change))}
                    </Text>
                  </Row>
                  {/* Bar grows right for more, left for less, from the middle */}
                  <View style={{ flexDirection: 'row', height: 8 }}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      {!up ? <View style={{ width: `${(Math.abs(r.change) / maxChange) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.success }} /> : null}
                    </View>
                    <View style={{ width: 2, backgroundColor: colors.border }} />
                    <View style={{ flex: 1 }}>
                      {up ? <View style={{ width: `${(Math.abs(r.change) / maxChange) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.danger }} /> : null}
                    </View>
                  </View>
                  <Text style={styles.hint}>
                    {money(r.a)} → {money(r.b)}{r.pct === null ? ' · new' : ` · ${r.pct > 0 ? '+' : ''}${r.pct}%`}
                  </Text>
                </View>
              );
            })}
            {compare.length === 0 ? <Text style={styles.hint}>No spending in these months.</Text> : null}
          </Card>
        </>
      ) : null}

      {tab === 'trends' ? (
        <>
          <Card>
            <Text style={styles.itemTitle}>Income vs expenses · 12 months</Text>
            <BarChart width={w} height={180} labels={trend.map((m) => monthLabel(m.key).slice(0, 1))} series={[{ name: 'Income', color: colors.success, values: trend.map((m) => m.income) }, { name: 'Expenses', color: colors.danger, values: trend.map((m) => m.expense) }]} format={compact} />
          </Card>
          <Card>
            <Text style={styles.itemTitle}>Savings rate</Text>
            <Text style={styles.hint}>Share of income kept each month. Aim for 20% or more.</Text>
            <AreaChart values={rates} labels={trend.map((m, i) => (i % 3 === 0 || i === trend.length - 1 ? `${monthLabel(m.key).slice(0, 3)} ${rates[i]}%` : ''))} width={w} height={120} color={colors.success} />
          </Card>
          <Card>
            <Text style={styles.itemTitle}>Monthly spending</Text>
            <HBars rows={[...trend].reverse().map((m) => ({ label: `${monthLabel(m.key)} ${m.key.slice(2, 4)}`, value: m.expense, color: colors.accent }))} format={money} />
          </Card>
        </>
      ) : null}

      {tab === 'people' ? (
        <>
          <Card>
            <Text style={styles.itemTitle}>Top shops & payees</Text>
            {spendByMerchant(inR, 8).length ? <HBars rows={spendByMerchant(inR, 8).map((m) => ({ label: m.merchant, value: m.total, sub: `${m.count}×`, color: colors.info }))} format={money} /> : <Text style={styles.hint}>No shop names recorded in this period.</Text>}
          </Card>
          <Card>
            <Text style={styles.itemTitle}>By family member</Text>
            <HBars rows={spendByMember(inR, data.members).map((m) => ({ label: m.name, value: m.total, color: colors.primary }))} format={money} />
          </Card>
          <Card>
            <Text style={styles.itemTitle}>How you paid</Text>
            <HBars rows={spendByPaymentMode(inR, data.accounts).map((m) => ({ label: m.label, value: m.value, color: m.color }))} format={money} />
          </Card>
        </>
      ) : null}

      {tab === 'networth' ? (
        <Card gradient>
          <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Net worth now</Text>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{money(history[history.length - 1]?.net ?? 0)}</Text>
          <View>
            <AreaChart values={history.map((h) => h.net)} labels={history.map((h, i) => (i % 3 === 0 || i === history.length - 1 ? h.label.slice(0, 3) : ''))} width={w} height={130} light lineColor="#FFD978" />
          </View>
          <Text style={{ color: '#ffffffb3', fontSize: 12 }}>Property and investment values use today’s figures.</Text>
        </Card>
      ) : null}

      <Button title="Year in review" variant="secondary" icon="sparkles-outline" onPress={() => router.push('/year')} />
    </Screen>
  );
}

const TABS: [Tab, string, string][] = [
  ['overview', 'Overview', 'pie-chart-outline'],
  ['compare', 'Compare months', 'git-compare-outline'],
  ['trends', '12-month trends', 'trending-up-outline'],
  ['people', 'Shops & people', 'people-outline'],
  ['networth', 'Net worth', 'stats-chart-outline'],
];
type Tab = 'overview' | 'compare' | 'trends' | 'people' | 'networth';

export default premiumOnly(Reports, 'Reports', 'Overview for any dates, month vs month, 12-month trends, shops and family members, net worth, and a PDF to share.');
