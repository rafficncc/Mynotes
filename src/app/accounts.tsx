import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { BalanceList } from '../components/BalanceList';
import { Button, Card, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { ACCOUNT_GROUP_OF, computeNetWorth, LIQUID_TYPES } from '../logic/balances';
import { personBalances } from '../logic/money2';
import { FREE_PER_CATEGORY, LIMIT_CATEGORIES, limitUsage } from '../logic/region';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { colors } from '../theme';


export default function Accounts() {
  const data = useAppData();
  const balances = useBalances();
  const { money, compact } = useMoney();
  const { only } = useLocalSearchParams<{ only?: 'debt' | 'cash' | 'investment' }>();
  const navigation = useNavigation();
  const debtOnly = only === 'debt';
  // "Cash & bank" and "Investments" tiles on Home show just those accounts.
  const group = only === 'cash' ? { title: 'Cash & bank', total: 'Money you can use now', keep: (t: string) => (LIQUID_TYPES as string[]).includes(t) } : only === 'investment' ? { title: 'Investments', total: 'Total invested value', keep: (t: string) => ACCOUNT_GROUP_OF[t as keyof typeof ACCOUNT_GROUP_OF] === 'investment' } : null;
  useEffect(() => navigation.setOptions({ title: debtOnly ? 'What we owe' : group?.title ?? 'Accounts' }), [navigation, debtOnly, group?.title]);
  // "Debt" from Home shows only cards, loans and money borrowed from people.
  const allPeople = personBalances(data.transactions);
  const accounts = debtOnly ? data.accounts.filter((a) => a.type === 'credit_card' || a.type === 'loan') : data.accounts;
  const people = debtOnly ? allPeople.filter((p) => p.balance < 0) : allPeople;
  const nw = computeNetWorth(accounts, balances, people);

  if (group) {
    const list = data.accounts.filter((a) => !a.archived && group.keep(a.type));
    const total = list.reduce((sum, a) => sum + Math.max(0, balances[a.id] ?? 0), 0);
    return (
      <Screen>
        <Card gradient>
          <Text style={{ color: '#ffffffb3', fontSize: 13 }}>{group.total}</Text>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>{money(total)}</Text>
          <Text style={{ color: '#FFD978', fontSize: 12, fontWeight: '700' }}>
            {list.length} account{list.length === 1 ? '' : 's'}
          </Text>
        </Card>
        {list.length ? (
          <BalanceList accounts={list} balances={balances} people={[]} money={money} />
        ) : (
          <Card><Text style={styles.itemSub}>Nothing added yet.</Text></Card>
        )}
        <Button title="Add account" icon="add" onPress={() => router.push('/account-form')} />
      </Screen>
    );
  }

  if (debtOnly) {
    return (
      <Screen>
        <Card gradient>
          <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Total we owe</Text>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#FF9E8A' }}>{money(nw.liabilities)}</Text>
          <Row>
            <Stat light label="Credit cards" value={compact(-nw.byGroup.credit)} />
            <Stat light label="Loans" value={compact(-nw.byGroup.loan)} />
            <Stat light label="To people" value={compact(-nw.byGroup.other)} />
          </Row>
        </Card>
        {nw.liabilities > 0 ? (
          <BalanceList accounts={accounts} balances={balances} people={people} money={money} />
        ) : (
          <Card><Text style={styles.itemSub}>No debts. Well done!</Text></Card>
        )}
        <Button title="Plan to clear these debts" icon="trending-down-outline" onPress={() => router.push('/debts')} />
        <Text style={[styles.hint, { textAlign: 'center' }]}>See which debt to clear first and your debt-free date (Premium).</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card gradient>
        <Row>
          <Stat light label="You own" value={compact(nw.assets)} color={colors.success} />
          <Stat light label="You owe" value={compact(nw.liabilities)} color={colors.danger} />
          <Stat light label="Net worth" value={compact(nw.net)} color={colors.warning} />
        </Row>
      </Card>
      {!data.settings.premium ? (
        <Text style={[styles.hint, { textAlign: 'center' }]} onPress={() => router.push('/premium')}>
          Free plan: {LIMIT_CATEGORIES.map((c) => `${limitUsage(data.accounts, c.key)}/${FREE_PER_CATEGORY} ${c.label}`).join(' · ')}. Tap for unlimited.
        </Text>
      ) : null}
      <BalanceList accounts={data.accounts} balances={balances} people={people} money={money} />
      <SectionTitle title="Add" />
      <Button title="Add account or card" icon="add" onPress={() => router.push('/account-form')} />
      <Text style={[styles.hint, { textAlign: 'center' }]}>
        Move money between accounts (ATM withdrawal, card bill payment, wallet top-up) with a Transfer.
      </Text>
    </Screen>
  );
}
