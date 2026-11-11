import { router } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL, computeNetWorth } from '../logic/balances';
import type { AccountType } from '../logic/types';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { colors } from '../theme';

const ORDER: AccountType[] = ['cash', 'bank', 'wallet', 'debit_card', 'credit_card', 'other'];

export default function Accounts() {
  const data = useAppData();
  const balances = useBalances();
  const { money } = useMoney();
  const nw = computeNetWorth(data.accounts, balances);
  const active = data.accounts.filter((a) => !a.archived);

  return (
    <Screen>
      <Card>
        <Row>
          <Stat label="You own" value={money(nw.assets)} color={colors.success} />
          <Stat label="You owe" value={money(nw.liabilities)} color={colors.danger} />
          <Stat label="Net worth" value={money(nw.net)} />
        </Row>
      </Card>
      {ORDER.map((type) => {
        const list = active.filter((a) => a.type === type);
        if (!list.length) return null;
        return (
          <Card key={type}>
            <Text style={styles.label}>{ACCOUNT_TYPE_LABEL[type]}</Text>
            {list.map((a) => {
              const linked = a.type === 'debit_card' && a.linkedBankId ? data.accounts.find((b) => b.id === a.linkedBankId) : undefined;
              const bal = balances[a.id] ?? 0;
              const sub =
                a.type === 'credit_card'
                  ? a.billingDay
                    ? `Bill day ${a.billingDay} · due day ${a.dueDay}${a.creditLimit ? ` · limit ${money(a.creditLimit)}` : ''}`
                    : 'Tap to add billing date'
                  : linked
                    ? `Linked to ${linked.name}`
                    : undefined;
              return (
                <ListItem
                  key={a.id}
                  icon={ACCOUNT_TYPE_ICON[a.type]}
                  iconColor={a.type === 'credit_card' ? colors.danger : colors.primary}
                  title={a.name}
                  subtitle={sub}
                  right={linked ? '' : a.type === 'credit_card' ? money(Math.max(0, -bal)) : money(bal)}
                  rightSub={a.type === 'credit_card' && !linked ? 'outstanding' : undefined}
                  rightColor={bal < 0 && a.type !== 'credit_card' ? colors.danger : undefined}
                  onPress={() => router.push(`/account-form?id=${a.id}`)}
                />
              );
            })}
          </Card>
        );
      })}
      <SectionTitle title="Add" />
      <Button title="Add account or card" icon="add" onPress={() => router.push('/account-form')} />
      <Text style={[styles.hint, { textAlign: 'center' }]}>
        Move money between accounts (ATM withdrawal, card bill payment, wallet top-up) with a Transfer.
      </Text>
    </Screen>
  );
}
