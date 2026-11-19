import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { LendForm, type LendKind } from '../components/LendForm';
import { TxnRow } from '../components/TxnRow';
import { Card, Empty, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { PEOPLE_ACCOUNT_ID, personBalances } from '../logic/money2';
import { normalize } from '../logic/text';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

/** Everything with one person: what was lent, borrowed and repaid, from which account, and the balance. */
export default function Person() {
  const { name = '' } = useLocalSearchParams<{ name: string }>();
  const navigation = useNavigation();
  const data = useAppData();
  const { money } = useMoney();
  const history = useMemo(
    () => data.transactions.filter((t) => t.person && normalize(t.person) === normalize(name)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [data.transactions, name],
  );
  const balance = personBalances(history)[0]?.balance ?? 0;
  const given = history.filter((t) => t.toAccountId === PEOPLE_ACCOUNT_ID).reduce((s, t) => s + t.amount, 0);
  const got = history.filter((t) => t.accountId === PEOPLE_ACCOUNT_ID).reduce((s, t) => s + t.amount, 0);
  const [kind, setKind] = useState<LendKind>(balance > 0 ? 'got_back' : balance < 0 ? 'paid_back' : 'lent');
  const [person, setPerson] = useState(name);
  const [amount, setAmount] = useState(balance ? String(Math.abs(balance)) : '');

  useEffect(() => navigation.setOptions({ title: name }), [navigation, name]);

  return (
    <Screen>
      <Card>
        <Text style={[styles.statValue, { color: balance > 0 ? colors.success : balance < 0 ? colors.danger : colors.text }]}>
          {balance === 0 ? 'All settled' : `${balance > 0 ? `${name} owes you` : `You owe ${name}`} ${money(Math.abs(balance))}`}
        </Text>
        <Row>
          <Stat label="You gave" value={`−${money(given)}`} color={colors.danger} />
          <Stat label="You received" value={`+${money(got)}`} color={colors.success} />
        </Row>
        <Text style={styles.hint}>“You gave” = money lent + your repayments. “You received” = money borrowed + their repayments.</Text>
      </Card>

      <SectionTitle title="Record a payment" />
      <LendForm kind={kind} setKind={setKind} person={person} setPerson={setPerson} amount={amount} setAmount={setAmount} known={[]} fixedPerson />

      <SectionTitle title={`History (${history.length})`} />
      {history.length ? (
        <Card>
          {history.map((t) => (
            <TxnRow key={t.id} t={t} accounts={data.accounts} categories={data.categories} money={money} />
          ))}
          <Text style={styles.hint}>Tap an entry to edit or delete it.</Text>
        </Card>
      ) : (
        <Empty icon="people-outline" title="Nothing recorded yet" />
      )}
    </Screen>
  );
}
