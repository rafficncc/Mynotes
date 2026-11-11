import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Chip, Empty, Icon, ListItem, styles } from '../../components/ui';
import { formatDate, monthLabel, shiftMonthKey, toISODate } from '../../logic/dates';
import type { TxnType } from '../../logic/types';
import { useAppData, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

export default function Transactions() {
  const data = useAppData();
  const { money } = useMoney();
  const [month, setMonth] = useState(toISODate(new Date()).slice(0, 7));
  const [type, setType] = useState<TxnType | 'all'>('all');
  const [accountId, setAccountId] = useState<string>('');
  const [query, setQuery] = useState('');

  const cat = (id?: string) => data.categories.find((c) => c.id === id);
  const acc = (id?: string) => data.accounts.find((a) => a.id === id);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.transactions
      .filter((t) => t.date.startsWith(month))
      .filter((t) => type === 'all' || t.type === type)
      .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
      .filter((t) => {
        if (!q) return true;
        const hay = [t.merchant, t.note, t.item, cat(t.categoryId)?.name, acc(t.accountId)?.name].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, month, type, accountId, query]);

  const totalOut = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIn = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, gap: 10, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable hitSlop={10} onPress={() => setMonth(shiftMonthKey(month, -1))}><Icon name="chevron-back" /></Pressable>
          <Text style={styles.sectionTitle}>{monthLabel(month)} {month.slice(0, 4)}</Text>
          <Pressable hitSlop={10} onPress={() => setMonth(shiftMonthKey(month, 1))}><Icon name="chevron-forward" /></Pressable>
        </View>
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
        renderItem={({ item: t }) => {
          const c = cat(t.categoryId);
          const isTransfer = t.type === 'transfer';
          const member = data.members.find((m) => m.id === t.memberId);
          return (
            <ListItem
              icon={isTransfer ? 'swap-horizontal' : c?.icon ?? 'pricetag-outline'}
              iconColor={isTransfer ? colors.info : c?.color}
              title={isTransfer ? `${acc(t.accountId)?.name} → ${acc(t.toAccountId)?.name}` : t.merchant || c?.name || 'Transaction'}
              subtitle={[formatDate(t.date), isTransfer ? t.note : c?.name, acc(t.accountId)?.name, member?.name].filter(Boolean).join(' · ')}
              right={`${t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}${money(t.amount)}`}
              rightColor={t.type === 'income' ? colors.success : isTransfer ? colors.info : undefined}
              onPress={() => router.push(`/add?id=${t.id}`)}
            />
          );
        }}
      />
      <Pressable
        onPress={() => router.push('/add')}
        style={{ position: 'absolute', right: 20, bottom: 24, backgroundColor: colors.primary, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 4 }}
      >
        <Icon name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}
