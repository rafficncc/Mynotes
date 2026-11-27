import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Calendar, DateField } from '../../components/DateField';
import { TxnRow } from '../../components/TxnRow';
import { DonutChart } from '../../components/charts';
import { Card, Chip, Empty, Icon, styles } from '../../components/ui';
import { spendByCategory } from '../../logic/analytics';
import { cycleKeyOf, cycleLabel, formatDate, shiftMonthKey, toISODate } from '../../logic/dates';
import type { TxnType } from '../../logic/types';
import { useAppData, useCycle, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

type Period = 'cycle' | 'year' | 'lastyear' | 'custom';
const PERIODS: [Period, string][] = [
  ['cycle', 'This cycle'],
  ['year', 'This year'],
  ['lastyear', 'Last year'],
  ['custom', 'Custom dates'],
];

export default function Transactions() {
  const data = useAppData();
  const { money, compact } = useMoney();
  const cycle = useCycle();
  const [month, setMonth] = useState(cycle.key);
  const [calendar, setCalendar] = useState(false);
  const [day, setDay] = useState('');
  const params = useLocalSearchParams<{ type?: TxnType }>();
  const [type, setType] = useState<TxnType | 'all'>(params.type ?? 'all');
  // Opened again from a Home tile with another filter: follow it (tabs stay mounted).
  const [lastParam, setLastParam] = useState(params.type);
  if (params.type !== lastParam) {
    setLastParam(params.type);
    if (params.type) setType(params.type);
  }
  // Period shown: a spending cycle (with arrows), a calendar year, or any start–end dates.
  const [period, setPeriod] = useState<Period>('cycle');
  const [periodMenu, setPeriodMenu] = useState(false);
  const thisYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo] = useState(toISODate(new Date()));
  const range: [string, string] | null =
    period === 'year' ? [`${thisYear}-01-01`, `${thisYear}-12-31`] : period === 'lastyear' ? [`${thisYear - 1}-01-01`, `${thisYear - 1}-12-31`] : period === 'custom' ? (from <= to ? [from, to] : [to, from]) : null;
  const [accountId, setAccountId] = useState<string>('');
  const [query, setQuery] = useState('');

  const cat = (id?: string) => data.categories.find((c) => c.id === id);
  const acc = (id?: string) => data.accounts.find((a) => a.id === id);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.transactions
      .filter((t) => (day ? t.date === day : range ? t.date >= range[0] && t.date <= range[1] : cycleKeyOf(t.date, cycle.startDay) === month))
      .filter((t) => type === 'all' || t.type === type)
      .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
      .filter((t) => {
        if (!q) return true;
        const hay = [t.merchant, t.note, t.item, t.person, cat(t.categoryId)?.name, acc(t.accountId)?.name].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, month, type, accountId, query, day, cycle.startDay, range?.[0], range?.[1]]);

  // Dots on the calendar: red = spent, green = income only
  const marks = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of data.transactions) {
      if (t.type === 'expense') m[t.date] = colors.danger;
      else if (t.type === 'income' && !m[t.date]) m[t.date] = colors.success;
    }
    return m;
  }, [data.transactions]);

  // Spending by category for whatever is shown: the cycle (or day), account and search
  const byCat = useMemo(() => spendByCategory(base, data.categories), [base, data.categories]);
  const [showChart, setShowChart] = useState(true);
  // Tapping a chart slice lists only that category (several categories for "Others").
  const [picked, setPicked] = useState<{ key: string; keys: string[] } | null>(null);
  const active = picked && (picked.key === '_rest' || byCat.some((c) => c.key === picked.key)) ? picked : null;
  const list = active ? base.filter((t) => t.type === 'expense' && active.keys.includes(t.categoryId ?? 'other')) : base;
  const pickedLabel = active ? (active.key === '_rest' ? 'Others' : byCat.find((c) => c.key === active.key)?.label) : null;

  const totalOut = base.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIn = base.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, gap: 10, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {range ? <View style={{ width: 24 }} /> : <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous period" onPress={() => { setDay(''); setMonth(shiftMonthKey(month, -1)); }}><Icon name="chevron-back" /></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="Show calendar" onPress={() => setCalendar((c) => !c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar-outline" color={colors.primary} />
            <Text style={styles.sectionTitle}>
              {day ? formatDate(day) : period === 'year' ? `${thisYear}` : period === 'lastyear' ? `${thisYear - 1}` : range ? `${formatDate(range[0])} – ${formatDate(range[1])}` : cycleLabel(month, cycle.startDay)}
            </Text>
          </Pressable>
          {range ? <View style={{ width: 24 }} /> : <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel="Next period" onPress={() => { setDay(''); setMonth(shiftMonthKey(month, 1)); }}><Icon name="chevron-forward" /></Pressable>}
        </View>
        {/* One small button; the period choices open only when needed */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Chip label={`${PERIODS.find(([k]) => k === period)![1]} ▾`} icon="time-outline" selected={periodMenu} onPress={() => setPeriodMenu((m) => !m)} />
          {periodMenu ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {PERIODS.map(([k, label]) => (
                <Chip
                  key={k}
                  label={label}
                  selected={period === k}
                  onPress={() => {
                    setPeriod(k);
                    setDay('');
                    setPeriodMenu(false);
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
        {period === 'custom' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><DateField label="From" value={from} onChange={setFrom} quick={false} /></View>
            <View style={{ flex: 1 }}><DateField label="To" value={to} onChange={setTo} quick={false} /></View>
          </View>
        ) : null}
        {calendar ? (
          <View style={{ gap: 6 }}>
            <Calendar
              value={day || undefined}
              marks={marks}
              onChange={(iso) => {
                setDay(iso === day ? '' : iso);
                setMonth(cycleKeyOf(iso, cycle.startDay));
                setPeriod('cycle');
              }}
            />
            {day ? <Chip label="Show the whole cycle" icon="close" onPress={() => setDay('')} /> : <Text style={styles.hint}>Tap a date to see that day. Red dot = money spent.</Text>}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Out {money(totalOut)}</Text>
          <Text style={{ color: colors.success, fontWeight: '700' }}>In {money(totalIn)}</Text>
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search shop, note, category…" placeholderTextColor={colors.muted} style={styles.input} />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '', name: 'All accounts' }, ...data.accounts.filter((a) => !a.archived)]}
          keyExtractor={(a) => a.id || 'all'}
          contentContainerStyle={{ gap: 8 }}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', gap: 8, marginRight: 8 }}>
              {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
                <Chip key={t} label={t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)} selected={type === t} onPress={() => setType(t)} color={colors.info} />
              ))}
            </View>
          }
          renderItem={({ item }) => <Chip label={item.name} selected={accountId === item.id} onPress={() => setAccountId(item.id)} />}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          byCat.length ? (
            <Card style={{ marginBottom: 12 }}>
              <Pressable onPress={() => setShowChart((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showChart }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.itemTitle}>Where the money went</Text>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{showChart ? 'Hide' : 'Show'}</Text>
              </Pressable>
              {showChart ? (
                <DonutChart
                  data={byCat}
                  centerLabel="Spent"
                  centerValue={compact(totalOut)}
                  format={money}
                  maxSlices={5}
                  selected={active?.key}
                  onSelect={(key, keys) => setPicked(active?.key === key ? null : { key, keys })}
                />
              ) : null}
              {active ? (
                <Pressable onPress={() => setPicked(null)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    Showing {pickedLabel}: {list.length} · {money(list.reduce((s, t) => s + t.amount, 0))}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Clear ✕</Text>
                </Pressable>
              ) : showChart ? (
                <Text style={[styles.hint, { marginTop: 6 }]}>Tap a category to see only its transactions.</Text>
              ) : null}
            </Card>
          ) : undefined
        }
        ListEmptyComponent={<Empty icon="receipt-outline" title="No transactions" text="Nothing matches this period and filter." />}
        renderItem={({ item: t }) => <TxnRow t={t} accounts={data.accounts} categories={data.categories} members={data.members} money={money} detailed />}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={() => router.push('/add')}
        style={{ position: 'absolute', right: 20, bottom: 24, backgroundColor: colors.primary, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 4 }}
      >
        <Icon name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}
