import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { ACCOUNT_TYPE_ICON } from '../logic/balances';
import { toISODate } from '../logic/dates';
import { PEOPLE_ACCOUNT_ID, type PersonBalance } from '../logic/money2';
import { notifyBalance, useAppData } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';
import { DateField } from './DateField';
import { ask } from './Dialog';
import { Button, Card, Chip, ChipRow, Field, styles } from './ui';

export type LendKind = 'lent' | 'borrowed' | 'got_back' | 'paid_back';
export const LEND_KINDS: { key: LendKind; label: string; icon: string }[] = [
  { key: 'lent', label: 'I lent', icon: 'arrow-up-circle-outline' },
  { key: 'borrowed', label: 'I borrowed', icon: 'arrow-down-circle-outline' },
  { key: 'got_back', label: 'They paid me back', icon: 'checkmark-circle-outline' },
  { key: 'paid_back', label: 'I paid them back', icon: 'checkmark-done-circle-outline' },
];
/** Money leaves your account when you lend or repay. */
export const isOut = (k: LendKind) => k === 'lent' || k === 'paid_back';

/** Records money lent, borrowed or repaid as a transfer between your account and the lend & borrow ledger. */
export function LendForm({ kind, setKind, person, setPerson, amount, setAmount, known, fixedPerson, onSaved }: {
  kind: LendKind;
  setKind: (k: LendKind) => void;
  person: string;
  setPerson: (p: string) => void;
  amount: string;
  setAmount: (a: string) => void;
  known: PersonBalance[];
  fixedPerson?: boolean;
  onSaved?: () => void;
}) {
  const data = useAppData();
  const { addTransaction, ensurePeopleAccount } = useStore();
  const accounts = data.accounts.filter((a) => !a.archived && a.type !== 'people' && a.type !== 'property');
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type === 'bank' || a.type === 'cash')?.id ?? accounts[0]?.id ?? '');
  const [date, setDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');
  const out = isOut(kind);

  const save = () => {
    const amt = parseFloat(amount);
    if (!person.trim()) return ask('Who is it?', 'Enter the person’s name.');
    if (!amt || amt <= 0) return ask('Enter the amount');
    if (!accountId) return ask(out ? 'Choose the account you paid from' : 'Choose the account you received the money in');
    ensurePeopleAccount();
    addTransaction({
      type: 'transfer',
      amount: amt,
      date,
      accountId: out ? accountId : PEOPLE_ACCOUNT_ID,
      toAccountId: out ? PEOPLE_ACCOUNT_ID : accountId,
      person: person.trim(),
      note: note.trim() || LEND_KINDS.find((k) => k.key === kind)!.label,
    });
    setAmount('');
    setNote('');
    notifyBalance(accountId, 'Saved');
    onSaved?.();
  };

  return (
    <Card>
      <ChipRow>
        {LEND_KINDS.map((k) => (
          <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
        ))}
      </ChipRow>
      {fixedPerson ? null : (
        <>
          <Field label="Person" value={person} onChangeText={setPerson} placeholder="e.g. Ravi (cousin)" />
          {known.length ? (
            <ChipRow>
              {known.slice(0, 6).map((b) => (
                <Chip key={b.person} label={b.person} onPress={() => setPerson(b.person)} />
              ))}
            </ChipRow>
          ) : null}
        </>
      )}
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <Text style={[styles.label, { color: out ? colors.danger : colors.success }]}>
        {out ? 'Paid from (this balance goes down)' : 'Received in (this balance goes up)'}
      </Text>
      <ChipRow>
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} icon={ACCOUNT_TYPE_ICON[a.type]} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
        <Chip label="New account" icon="add" onPress={() => router.push('/account-form')} />
      </ChipRow>
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. hospital bill, school fees" />
      <Button title="Save" icon="checkmark" onPress={save} />
    </Card>
  );
}
