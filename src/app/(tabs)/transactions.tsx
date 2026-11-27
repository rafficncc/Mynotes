import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Calendar } from '../../components/DateField';
import { TxnRow } from '../../components/TxnRow';
import { Chip, Empty, Icon, styles } from '../../components/ui';
import { cycleKeyOf, cycleLabel, formatDate, shiftMonthKey } from '../../logic/dates';
import type { TxnType } from '../../logic/types';
import { useAppData, useCycle, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

export default function Transactions() {
  const data = useAppData();
  const { money } = useMoney();
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
  const [accountId, setAccountId] = useState<string>('');
  const [query, setQuery] = useState('');

  const cat = (id?: string) => data.categories.find((c) => c.id === id);
  const acc = (id?: string) => data.accounts.find((a) => a.id === id);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.transactions
      .filter((t) => (day ? t.date === day : cycleKeyOf(t.date, cycle.startDay) === month))
      .filter((t) => type === 'all' || t.type === type)
      .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
      .filter((t) => {
        if (!q) return true;
        const hay = [t.merchant, t.note, t.item, t.person, cat(t.categoryId)?.name, acc(t.accountId)?.name].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, month, type, accountId, query, day, cycle.startDay]);

  // Dots on the calendar: red = spent, green = income only
  const marks = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of data.transactions) {
      if (t.type === 'expense') m[t.date] = colors.danger;
      else if (t.type === 'income' && !m[t.date]) m[t.date] = colors.success;
    }
    return m;
  }, [data.transactions]);

  const totalOut = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIn = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, gap: 10, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous period" onPress={() => { setDay(''); setMonth(shiftMonthKey(month, -1)); }}><Icon name="chevron-back" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Show calendar" onPress={() => setCalendar((c) => !c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar-outline" color={colors.primary} />
            <Text style={styles.sectionTitle}>{day ? formatDate(day) : cycleLabel(month, cycle.startDay)}</Text>
          </Pressable>
          <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel="Next period" onPress={() => { setDay(''); setMonth(shiftMonthKey(month, 1)); }}><Icon name="chevron-forward" /></Pressable>
        </View>
        {calendar ? (
          <View style={{ gap: 6 }}>
            <Calendar
              value={day || undefined}
              marks={marks}
              onChange={(iso) => {
                setDay(iso === day ? '' : iso);
                setMonth(cycleKeyOf(iso, cycle.startDay));
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
        ListEmptyComponent={<Empty icon="receipt-outline" title="No transactions" text="Nothing matches this month and filter." />}
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
