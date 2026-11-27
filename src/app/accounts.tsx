import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { BalanceList } from '../components/BalanceList';
import { Button, Card, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { computeNetWorth } from '../logic/balances';
import { personBalances } from '../logic/money2';
import { FREE_PER_CATEGORY, LIMIT_CATEGORIES, limitUsage } from '../logic/region';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { colors } from '../theme';


export default function Accounts() {
  const data = useAppData();
  const balances = useBalances();
  const { money, compact } = useMoney();
  const { only } = useLocalSearchParams<{ only?: 'debt' }>();
  const navigation = useNavigation();
  const debtOnly = only === 'debt';
  useEffect(() => navigation.setOptions({ title: debtOnly ? 'What we owe' : 'Accounts' }), [navigation, debtOnly]);
  // "Debt" from Home shows only cards, loans and money borrowed from people.
  const allPeople = personBalances(data.transactions);
  const accounts = debtOnly ? data.accounts.filter((a) => a.type === 'credit_card' || a.type === 'loan') : data.accounts;
  const people = debtOnly ? allPeople.filter((p) => p.balance < 0) : allPeople;
  const nw = computeNetWorth(accounts, balances, people);

  if (debtOnly) {
    return (
      <Screen>
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <Text style={styles.itemSub}>Total we owe</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.danger }}>{money(nw.liabilities)}</Text>
          <Row>
            <Stat label="Credit cards" value={compact(-nw.byGroup.credit)} />
            <Stat label="Loans" value={compact(-nw.byGroup.loan)} />
            <Stat label="To people" value={compact(-nw.byGroup.other)} />
          </Row>
        </Card>
        {nw.liabilities > 0 ? (
          <BalanceList accounts={accounts} balances={balances} nw={nw} people={people} money={money} />
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
      <Card>
        <Row>
          <Stat label="You own" value={compact(nw.assets)} color={colors.success} />
          <Stat label="You owe" value={compact(nw.liabilities)} color={colors.danger} />
          <Stat label="Net worth" value={compact(nw.net)} />
        </Row>
      </Card>
      {!data.settings.premium ? (
        <Text style={[styles.hint, { textAlign: 'center' }]} onPress={() => router.push('/premium')}>
          Free plan: {LIMIT_CATEGORIES.map((c) => `${limitUsage(data.accounts, c.key)}/${FREE_PER_CATEGORY} ${c.label}`).join(' · ')}. Tap for unlimited.
        </Text>
      ) : null}
      <BalanceList accounts={data.accounts} balances={balances} nw={nw} people={people} money={money} />
      <SectionTitle title="Add" />
      <Button title="Add account or card" icon="add" onPress={() => router.push('/account-form')} />
      <Text style={[styles.hint, { textAlign: 'center' }]}>
        Move money between accounts (ATM withdrawal, card bill payment, wallet top-up) with a Transfer.
      </Text>
    </Screen>
  );
}
