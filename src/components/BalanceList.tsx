import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL, investOption, isLiability } from '../logic/balances';
import type { PersonBalance } from '../logic/money2';
import type { Account } from '../logic/types';
import { colors } from '../theme';
import { Card, Icon, ListItem, Row } from './ui';

// Display sections for the Accounts page: finer than the net-worth groups so each list is short and clear.
const SECTIONS: { key: string; label: string; icon: string; color: string; types: Account['type'][] }[] = [
  { key: 'bank', label: 'Bank accounts', icon: 'business-outline', color: '#2F6FC4', types: ['bank', 'debit_card'] },
  { key: 'cash', label: 'Cash & wallets', icon: 'cash-outline', color: '#14915F', types: ['cash', 'wallet'] },
  { key: 'invest', label: 'Investments & gold', icon: 'trending-up-outline', color: '#B9860F', types: ['investment', 'deposit', 'gold'] },
  { key: 'credit', label: 'Credit cards', icon: 'card-outline', color: '#C2414F', types: ['credit_card'] },
  { key: 'loan', label: 'Loans', icon: 'document-text-outline', color: '#C9671C', types: ['loan'] },
  { key: 'property', label: 'Property', icon: 'home-outline', color: '#6E48C2', types: ['property'] },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#5B6B7A', types: ['other'] },
];

/** Every account's own balance in clear sections (bank, cash, investments, cards, loans…), plus money lent and borrowed. */
export function BalanceList({ accounts, balances, people, money }: { accounts: Account[]; balances: Record<string, number>; people: PersonBalance[]; money: (n: number) => string }) {
  const active = accounts.filter((a) => !a.archived && a.type !== 'people');
  const owed = people.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const owe = -people.filter((p) => p.balance < 0).reduce((s, p) => s + p.balance, 0);
  const sub = (a: Account) => {
    const linked = a.type === 'debit_card' && a.linkedBankId ? accounts.find((b) => b.id === a.linkedBankId) : undefined;
    const owing = Math.max(0, -(balances[a.id] ?? 0));
    if (a.type === 'credit_card') return a.creditLimit ? `${money(Math.max(0, a.creditLimit - owing))} available of ${money(a.creditLimit)}` : a.billingDay ? `Bill day ${a.billingDay} · due day ${a.dueDay}` : 'Tap to add billing date';
    if (linked) return `Debit card · uses ${linked.name}`;
    if (a.type === 'loan' && a.interestRate) return `${a.interestRate}% interest`;
    if (a.type === 'gold' && a.goldGrams) return `${a.goldGrams} g`;
    return a.type === 'investment' ? investOption(a)?.label : ACCOUNT_TYPE_LABEL[a.type];
  };
  return (
    <>
      {SECTIONS.map((sec) => {
        const list = active.filter((a) => sec.types.includes(a.type));
        if (!list.length) return null;
        const total = list.reduce((s, a) => s + (a.type === 'debit_card' && a.linkedBankId ? 0 : balances[a.id] ?? 0), 0);
        return <Section key={sec.key} label={sec.label} icon={sec.icon} color={sec.color} total={money(Math.abs(total))} negative={total < 0} count={list.length}>
          {list.map((a) => {
            const linked = a.type === 'debit_card' && !!a.linkedBankId;
            const bal = balances[a.id] ?? 0;
            return (
              <ListItem
                key={a.id}
                icon={a.type === 'investment' ? investOption(a)?.icon ?? ACCOUNT_TYPE_ICON.investment : ACCOUNT_TYPE_ICON[a.type]}
                iconColor={sec.color}
                title={a.name}
                subtitle={sub(a)}
                right={linked ? '' : isLiability(a.type) ? money(Math.max(0, -bal)) : money(bal)}
                rightSub={isLiability(a.type) && !linked ? 'outstanding' : undefined}
                rightColor={isLiability(a.type) || bal < 0 ? colors.danger : undefined}
                onPress={() => router.push(`/account-form?id=${a.id}`)}
              />
            );
          })}
        </Section>;
      })}
      {owed > 0 || owe > 0 ? (
        <Section label="Lent & borrowed" icon="people-outline" color="#0E8A9A" total={money(Math.abs(owed - owe))} negative={owed < owe} count={(owed > 0 ? 1 : 0) + (owe > 0 ? 1 : 0)}>
          {owed > 0 ? <ListItem icon="arrow-up-circle-outline" iconColor={colors.success} title="Others owe you" subtitle="Money you lent" right={`+${money(owed)}`} rightColor={colors.success} onPress={() => router.push('/people')} /> : null}
          {owe > 0 ? <ListItem icon="arrow-down-circle-outline" iconColor={colors.danger} title="You owe others" subtitle="Money you borrowed" right={`−${money(owe)}`} rightColor={colors.danger} onPress={() => router.push('/people')} /> : null}
        </Section>
      ) : null}
    </>
  );
}

function Section({ label, icon, color, total, negative, count, children }: { label: string; icon: string; color: string; total: string; negative: boolean; count: number; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ gap: 8, marginTop: 4 }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={15} color={color} />
        </View>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted }}>
          {label.toUpperCase()} · {count}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: negative ? colors.danger : colors.text }}>
          {negative ? '−' : ''}
          {total}
        </Text>
      </Row>
      <Card style={{ paddingVertical: 6, gap: 0, borderLeftWidth: 4, borderLeftColor: color }}>{children}</Card>
    </View>
  );
}
