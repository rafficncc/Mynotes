import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Empty, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { formatDate, toISODate } from '../logic/dates';
import { PEOPLE_ACCOUNT_ID, personBalances } from '../logic/money2';
import { normalize } from '../logic/text';
import { SPENDABLE_TYPES } from '../logic/balances';
import { notifyBalance, useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

type Kind = 'lent' | 'borrowed' | 'got_back' | 'paid_back';
const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: 'lent', label: 'I lent', icon: 'arrow-up-circle-outline' },
  { key: 'borrowed', label: 'I borrowed', icon: 'arrow-down-circle-outline' },
  { key: 'got_back', label: 'They paid me back', icon: 'checkmark-circle-outline' },
  { key: 'paid_back', label: 'I paid them back', icon: 'checkmark-done-circle-outline' },
];

export default function People() {
  const data = useAppData();
  const { addTransaction, ensurePeopleAccount } = useStore();
  const { money } = useMoney();
  const [kind, setKind] = useState<Kind>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(data.accounts.find((a) => a.type === 'bank' || a.type === 'cash')?.id ?? '');
  const [date, setDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const balances = useMemo(() => personBalances(data.transactions), [data.transactions]);
  const owedToMe = balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const iOwe = -balances.filter((b) => b.balance < 0).reduce((s, b) => s + b.balance, 0);
  const accounts = data.accounts.filter((a) => !a.archived && SPENDABLE_TYPES.includes(a.type));

  const save = () => {
    const amt = parseFloat(amount);
    if (!person.trim()) return ask('Who is it?', 'Enter the person’s name.');
    if (!amt || amt <= 0) return ask('Enter the amount');
    if (!accountId) return ask('Choose the account the money came from or went to');
    ensurePeopleAccount();
    // Money going out to them (lent / repaid) = transfer to People; coming in = transfer from People.
    const out = kind === 'lent' || kind === 'paid_back';
    addTransaction({
      type: 'transfer',
      amount: amt,
      date,
      accountId: out ? accountId : PEOPLE_ACCOUNT_ID,
      toAccountId: out ? PEOPLE_ACCOUNT_ID : accountId,
      person: person.trim(),
      note: note.trim() || KINDS.find((k) => k.key === kind)!.label,
    });
    setAmount('');
    setNote('');
    notifyBalance(accountId, 'Saved');
  };

  const history = (name: string) =>
    data.transactions
      .filter((t) => t.person && normalize(t.person) === normalize(name))
      .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <Card>
        <Row>
          <Stat label="Others owe you" value={money(owedToMe)} color={colors.success} />
          <Stat label="You owe others" value={money(iOwe)} color={colors.danger} />
        </Row>
      </Card>

      {balances.length === 0 ? (
        <Empty icon="people-outline" title="No money lent or borrowed yet" text="Record money lent to relatives and friends, or split a bill when you add an expense." />
      ) : null}
      {balances.map((b) => (
        <Card key={b.person} style={{ padding: 12 }}>
          <ListItem
            icon={b.balance >= 0 ? 'arrow-up-circle' : 'arrow-down-circle'}
            iconColor={b.balance > 0 ? colors.success : b.balance < 0 ? colors.danger : colors.muted}
            title={b.person}
            subtitle={b.balance === 0 ? 'Settled' : b.balance > 0 ? `Owes you · last ${formatDate(b.last)}` : `You owe · last ${formatDate(b.last)}`}
            right={money(Math.abs(b.balance))}
            rightColor={b.balance > 0 ? colors.success : b.balance < 0 ? colors.danger : undefined}
            onPress={() => setOpen(open === b.person ? null : b.person)}
          />
          {open === b.person ? (
            <View style={{ gap: 4 }}>
              {history(b.person).map((t) => (
                <Text key={t.id} style={styles.itemSub}>
                  {formatDate(t.date)} · {t.note ?? ''} · {t.toAccountId === PEOPLE_ACCOUNT_ID ? '+' : '−'}{money(t.amount)}
                </Text>
              ))}
              {b.balance !== 0 ? (
                <Chip
                  label={b.balance > 0 ? 'Record repayment from them' : 'Record my repayment'}
                  icon="checkmark"
                  onPress={() => {
                    setKind(b.balance > 0 ? 'got_back' : 'paid_back');
                    setPerson(b.person);
                    setAmount(String(Math.abs(b.balance)));
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}

      <SectionTitle title="Record" />
      <Card>
        <ChipRow>
          {KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </ChipRow>
        <Field label="Person" value={person} onChangeText={setPerson} placeholder="e.g. Ravi (cousin)" />
        {balances.length ? (
          <ChipRow>
            {balances.slice(0, 6).map((b) => (
              <Chip key={b.person} label={b.person} onPress={() => setPerson(b.person)} />
            ))}
          </ChipRow>
        ) : null}
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        <Text style={styles.label}>{kind === 'lent' || kind === 'paid_back' ? 'Paid from' : 'Received in'}</Text>
        <ChipRow>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </ChipRow>
        <DateField label="Date" value={date} onChange={setDate} />
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. hospital bill, school fees" />
        <Button title="Save" icon="checkmark" onPress={save} />
      </Card>
    </Screen>
  );
}
