import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, ListItem, Row, Screen, SectionTitle, Stat, HeaderAdd, Button } from '../components/ui';
import { LendForm, type LendKind } from '../components/LendForm';
import { formatDate } from '../logic/dates';
import { personBalances } from '../logic/money2';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

export default function People() {
  const data = useAppData();
  const { money } = useMoney();
  const [kind, setKind] = useState<LendKind>('lent');
  const [adding, setAdding] = useState(false);
  const formOpen = adding;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Record lent or borrowed money" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);
  const close = () => setAdding(false);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');

  const balances = useMemo(() => personBalances(data.transactions), [data.transactions]);
  const owedToMe = balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const iOwe = -balances.filter((b) => b.balance < 0).reduce((s, b) => s + b.balance, 0);

  if (formOpen) {
    return (
      <Screen>
        <SectionTitle title="Record" />
        <LendForm onSaved={close} kind={kind} setKind={setKind} person={person} setPerson={setPerson} amount={amount} setAmount={setAmount} known={balances} />
        <Button title="Cancel" variant="secondary" onPress={close} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card gradient>
        <Row>
          <Stat light label="Others owe you" value={`+${money(owedToMe)}`} color={colors.success} />
          <Stat light label="You owe others" value={`−${money(iOwe)}`} color={colors.danger} />
        </Row>
      </Card>

      {balances.length === 0 ? (
        <Empty icon="people-outline" title="No money lent or borrowed yet" text="Record money lent to relatives and friends, or split a bill when you add an expense." />
      ) : (
        <Card>
          {balances.map((b) => (
            <ListItem
              key={b.person}
              icon={b.balance >= 0 ? 'arrow-up-circle' : 'arrow-down-circle'}
              iconColor={b.balance > 0 ? colors.success : b.balance < 0 ? colors.danger : colors.muted}
              title={b.person}
              subtitle={`${b.balance === 0 ? 'Settled' : b.balance > 0 ? 'Owes you' : 'You owe'} · ${b.count} entries · last ${formatDate(b.last)} · tap for details`}
              right={b.balance === 0 ? money(0) : `${b.balance > 0 ? '+' : '−'}${money(Math.abs(b.balance))}`}
              rightColor={b.balance > 0 ? colors.success : b.balance < 0 ? colors.danger : undefined}
              onPress={() => router.push(`/person?name=${encodeURIComponent(b.person)}`)}
            />
          ))}
        </Card>
      )}

      <Button title="Record lent or borrowed money" icon="add" onPress={() => setAdding(true)} />
    </Screen>
  );
}
