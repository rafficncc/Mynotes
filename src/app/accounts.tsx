import { router } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { ACCOUNT_GROUPS, ACCOUNT_TYPE_ICON, computeNetWorth, isLiability } from '../logic/balances';
import { FREE_LIMITS } from '../logic/region';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { colors } from '../theme';


export default function Accounts() {
  const data = useAppData();
  const balances = useBalances();
  const { money, compact } = useMoney();
  const nw = computeNetWorth(data.accounts, balances);
  const active = data.accounts.filter((a) => !a.archived);

  return (
    <Screen>
      <Card>
        <Row>
          <Stat label="You own" value={compact(nw.assets)} color={colors.success} />
          <Stat label="You owe" value={compact(nw.liabilities)} color={colors.danger} />
          <Stat label="Net worth" value={compact(nw.net)} />
        </Row>
      </Card>
      {!data.settings.premium ? (
        <Text style={[styles.hint, { textAlign: 'center' }]} onPress={() => router.push('/premium')}>
          Free plan: {active.filter((a) => a.type !== 'credit_card').length}/{FREE_LIMITS.accounts} accounts · {active.filter((a) => a.type === 'credit_card').length}/{FREE_LIMITS.creditCards} credit cards. Tap for unlimited.
        </Text>
      ) : null}
      {ACCOUNT_GROUPS.map((group) => {
        const list = active.filter((a) => group.types.includes(a.type));
        if (!list.length) return null;
        return (
          <Card key={group.key}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.label}>{group.label}</Text>
              <Text style={[styles.label, { color: nw.byGroup[group.key] < 0 ? colors.danger : colors.text }]}>{money(nw.byGroup[group.key])}</Text>
            </Row>
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
                    : a.type === 'loan' && a.interestRate
                      ? `${a.interestRate}% interest`
                      : undefined;
              return (
                <ListItem
                  key={a.id}
                  icon={ACCOUNT_TYPE_ICON[a.type]}
                  iconColor={isLiability(a.type) ? colors.danger : colors.primary}
                  title={a.name}
                  subtitle={sub}
                  right={linked ? '' : isLiability(a.type) ? money(Math.max(0, -bal)) : money(bal)}
                  rightSub={isLiability(a.type) && !linked ? 'outstanding' : undefined}
                  rightColor={isLiability(a.type) || bal < 0 ? colors.danger : undefined}
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
