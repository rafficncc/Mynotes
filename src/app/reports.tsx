import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, DonutChart } from '../components/charts';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { currentCycleKey, cycleBounds, formatDate, monthLabel, shiftMonthKey, toISODate } from '../logic/dates';
import { compareRanges, monthRange, netWorthHistory, rangeReport, reportHtml } from '../logic/reports';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

type Preset = 'cycle' | 'last_cycle' | 'year' | 'last_year' | 'custom';

export default function Reports() {
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

  return (
    <Screen>
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
      <Text style={styles.itemSub}>{formatDate(range[0])} – {formatDate(range[1])} · {report.count} transactions</Text>
      <Card>
        <Row>
          <Stat label="Income" value={money(report.income)} color={colors.success} />
          <Stat label="Spent" value={money(report.expense)} color={colors.danger} />
          <Stat label="Saved" value={money(report.saved)} />
        </Row>
      </Card>
      <Card>
        <DonutChart data={report.byCategory} centerLabel="Spent" centerValue={compact(report.expense)} format={money} />
      </Card>
      <Button title={busy ? 'Preparing…' : 'Share as PDF'} icon="document-text-outline" disabled={busy} onPress={pdf} />

      <SectionTitle title="Compare two months" />
      <Card>
        <Text style={styles.label}>From</Text>
        <ChipRow>
          {months.slice(1).map((m) => (
            <Chip key={m} label={`${monthLabel(m)} ${m.slice(2, 4)}`} selected={monthA === m} onPress={() => setMonthA(m)} />
          ))}
        </ChipRow>
        <Text style={styles.label}>To</Text>
        <ChipRow>
          {months.slice(0, 6).map((m) => (
            <Chip key={m} label={`${monthLabel(m)} ${m.slice(2, 4)}`} selected={monthB === m} onPress={() => setMonthB(m)} />
          ))}
        </ChipRow>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.itemTitle}>Total</Text>
          <Text style={styles.itemTitle}>
            {money(totalA)} → {money(totalB)} <Text style={{ color: totalB > totalA ? colors.danger : colors.success }}>{totalA ? `${totalB >= totalA ? '+' : ''}${Math.round(((totalB - totalA) / totalA) * 100)}%` : ''}</Text>
          </Text>
        </Row>
        {compare.slice(0, 12).map((r) => (
          <Row key={r.key} style={{ justifyContent: 'space-between' }}>
            <Text style={[styles.insightText, { flex: 1 }]} numberOfLines={1}>{r.label}</Text>
            <Text style={styles.insightText}>{money(r.a)} → {money(r.b)} </Text>
            <Text style={[styles.insightText, { width: 56, textAlign: 'right', color: r.change > 0 ? colors.danger : colors.success }]}>
              {r.pct === null ? 'new' : `${r.pct > 0 ? '+' : ''}${r.pct}%`}
            </Text>
          </Row>
        ))}
      </Card>

      <SectionTitle title="Net worth over 12 months" />
      <Card>
        <BarChart width={Math.min(width, 720) - 64} labels={history.map((h) => h.label)} series={[{ name: 'Net worth', color: colors.primary, values: history.map((h) => Math.max(0, h.net)) }]} format={compact} />
        <Text style={styles.hint}>Now {money(history[history.length - 1]?.net ?? 0)}. Property and investment values use today’s figures.</Text>
      </Card>

      <Button title="Year in review" variant="secondary" icon="sparkles-outline" onPress={() => router.push('/year')} />
    </Screen>
  );
}
