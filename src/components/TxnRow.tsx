import { router } from 'expo-router';
import { formatDate } from '../logic/dates';
import { txnSign } from '../logic/money2';
import type { Account, Category, Member, Transaction } from '../logic/types';
import { colors } from '../theme';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './ui';

/** One transaction in a list: money in is "+" and green, money out is "−" and red, moves between your own accounts are blue. */
export function TxnRow({ t, accounts, categories, members, money, detailed, hideDate }: { t: Transaction; accounts: Account[]; categories: Category[]; members?: Member[]; money: (n: number) => string; detailed?: boolean; hideDate?: boolean }) {
  const acc = (id?: string) => accounts.find((a) => a.id === id);
  const c = categories.find((x) => x.id === t.categoryId);
  const sign = txnSign(t);
  const from = acc(t.accountId);
  const to = acc(t.toAccountId);
  const isTransfer = t.type === 'transfer';
  const own = t.person ? (sign < 0 ? from : to) : from; // the user's account in a lend/borrow entry
  const cardBill = isTransfer && !t.person && to?.type === 'credit_card' && from?.type !== 'credit_card';
  const title = t.person
    ? `${t.person} · ${t.note ?? (sign < 0 ? 'Money given' : 'Money received')}`
    : cardBill
      ? `Card bill · ${to?.name}`
      : isTransfer
        ? `${from?.name ?? '?'} → ${to?.name ?? '?'}`
        : t.merchant || c?.name || 'Transaction';
  const member = members?.find((m) => m.id === t.memberId);
  const subtitle = [hideDate ? undefined : formatDate(t.date), t.person || cardBill ? own?.name ?? from?.name : isTransfer ? t.note : detailed ? c?.name : undefined, !isTransfer ? from?.name : undefined, member?.name]
    .filter(Boolean)
    .join(' · ');
  const iconColor = (t.person ? (sign < 0 ? colors.danger : colors.success) : isTransfer ? colors.info : c?.color) ?? colors.primary;
  const amountColor = sign < 0 ? colors.danger : sign > 0 ? colors.success : colors.info;
  return (
    <Pressable
      onPress={() => router.push(`/add?id=${t.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sign < 0 ? 'minus' : sign > 0 ? 'plus' : ''} ${money(t.amount)}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconColor + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={t.person ? 'people-outline' : cardBill ? 'card' : isTransfer ? 'swap-horizontal' : c?.icon ?? 'pricetag-outline'} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: amountColor }}>
        {sign < 0 ? '−' : sign > 0 ? '+' : ''}
        {money(t.amount)}
      </Text>
    </Pressable>
  );
}
