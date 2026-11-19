import { router } from 'expo-router';
import { formatDate } from '../logic/dates';
import { txnSign } from '../logic/money2';
import type { Account, Category, Member, Transaction } from '../logic/types';
import { colors } from '../theme';
import { ListItem } from './ui';

/** One transaction in a list: money in is "+" and green, money out is "−" and red, moves between your own accounts are blue. */
export function TxnRow({ t, accounts, categories, members, money, detailed }: { t: Transaction; accounts: Account[]; categories: Category[]; members?: Member[]; money: (n: number) => string; detailed?: boolean }) {
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
  const subtitle = [formatDate(t.date), t.person || cardBill ? own?.name ?? from?.name : isTransfer ? t.note : detailed ? c?.name : undefined, !isTransfer ? from?.name : undefined, member?.name]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListItem
      icon={t.person ? 'people-outline' : cardBill ? 'card' : isTransfer ? 'swap-horizontal' : c?.icon ?? 'pricetag-outline'}
      iconColor={t.person ? (sign < 0 ? colors.danger : colors.success) : isTransfer ? colors.info : c?.color}
      title={title}
      subtitle={subtitle}
      right={`${sign < 0 ? '−' : sign > 0 ? '+' : ''}${money(t.amount)}`}
      rightColor={sign < 0 ? colors.danger : sign > 0 ? colors.success : colors.info}
      onPress={() => router.push(`/add?id=${t.id}`)}
    />
  );
}
