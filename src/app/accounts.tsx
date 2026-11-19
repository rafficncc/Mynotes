import { router } from 'expo-router';
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
  const people = personBalances(data.transactions);
  const nw = computeNetWorth(data.accounts, balances, people);

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
