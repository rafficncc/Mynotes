import { ask } from '../components/Dialog';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { Button, Card, Chip, ChipRow, Empty, Field, ProgressBar, Row, Screen, SectionTitle, styles, HeaderAdd } from '../components/ui';
import { formatShortDate, toISODate } from '../logic/dates';
import { EMI_KIND_LABEL, emiAmount, emiStatus } from '../logic/emi';
import type { EmiKind, EmiPlan } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';

const KINDS: EmiKind[] = ['card_emi', 'loan_emi', 'other'];

export default function Emis() {
  const data = useAppData();
  const { saveEmi, deleteEmi } = useStore();
  const { money } = useMoney();
  const on = new Date();

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const formOpen = adding || !!editing;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Add an EMI" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);
  const close = () => reset();
  const [kind, setKind] = useState<EmiKind>('card_emi');
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [months, setMonths] = useState('12');
  const [rate, setRate] = useState('');
  const [monthly, setMonthly] = useState('');
  const [startDate, setStartDate] = useState(toISODate(on));
  const [remind, setRemind] = useState(3);

  const accounts = data.accounts.filter((a) => !a.archived && (kind === 'card_emi' ? a.type === 'credit_card' : kind === 'loan_emi' ? a.type === 'loan' || a.type === 'bank' : a.type !== 'credit_card'));
  const p = parseFloat(principal) || 0;
  const n = parseInt(months, 10) || 0;
  const computed = p > 0 && n > 0 ? emiAmount(p, parseFloat(rate) || 0, n) : 0;

  const edit = (e: EmiPlan) => {
    setEditing(e.id);
    setKind(e.kind);
    setName(e.name);
    setAccountId(e.accountId ?? '');
    setPrincipal(String(e.principal));
    setMonths(String(e.totalMonths));
    setRate(e.interestRate ? String(e.interestRate) : '');
    setMonthly(String(e.monthlyAmount));
    setStartDate(e.startDate);
    setRemind(e.remindDaysBefore);
  };
  const reset = () => {
    setEditing(null);
    setAdding(false);
    setName('');
    setPrincipal('');
    setMonthly('');
    setRate('');
  };

  const save = () => {
    const m = parseFloat(monthly) || computed;
    if (!name.trim()) return ask('Name the EMI', 'e.g. “iPhone on card”, “Home loan”');
    if (!n || !m) return ask('Enter the number of months and the loan amount or EMI amount');
    const existing = data.emis.find((e) => e.id === editing);
    saveEmi({
      id: editing ?? undefined,
      name: name.trim(),
      kind,
      accountId: accountId || undefined,
      transactionId: existing?.transactionId,
      principal: p || m * n,
      monthlyAmount: m,
      totalMonths: n,
      startDate,
      interestRate: parseFloat(rate) || undefined,
      remindDaysBefore: remind,
      lastPaid: existing?.lastPaid,
    });
    reset();
  };

  const active = data.emis.filter((e) => !emiStatus(e, on).finished);
  const finished = data.emis.filter((e) => emiStatus(e, on).finished);
  const monthlyTotal = active.reduce((s, e) => s + e.monthlyAmount, 0);
  const remainingTotal = active.reduce((s, e) => s + emiStatus(e, on).remainingAmount, 0);

  if (formOpen) {
    return (
      <Screen>
        <SectionTitle title={editing ? 'Edit EMI' : 'Add a running EMI'} />
        <Card>
          <ChipRow>
            {KINDS.map((k) => (
              <Chip key={k} label={EMI_KIND_LABEL[k]} selected={kind === k} onPress={() => { setKind(k); setAccountId(''); }} />
            ))}
          </ChipRow>
          <Field label="Name" value={name} onChangeText={setName} placeholder={kind === 'card_emi' ? 'e.g. Phone on Rewards Card' : 'e.g. Home loan'} />
          {accounts.length ? (
            <>
              <Text style={styles.label}>{kind === 'card_emi' ? 'Credit card' : 'Loan / paid from'}</Text>
              <ChipRow>
                {accounts.map((a) => (
                  <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
                ))}
              </ChipRow>
              {kind === 'loan_emi' ? <Text style={styles.hint}>Pick the loan account so each EMI reduces the loan balance (the interest part is recorded as an expense). Add the loan under Accounts first if it isn’t here.</Text> : null}
            </>
          ) : null}
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Loan / purchase amount" value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" placeholder="60000" /></View>
            <View style={{ flex: 1 }}><Field label="Months" value={months} onChangeText={setMonths} keyboardType="number-pad" placeholder="12" /></View>
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Interest % / year" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0 = no-cost" /></View>
            <View style={{ flex: 1 }}><Field label="EMI amount" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" placeholder={computed ? String(computed) : 'auto'} hint={computed ? `Calculated: ${money(computed)}` : 'Leave blank to calculate'} /></View>
          </Row>
          <DateField label="First instalment date" value={startDate} onChange={setStartDate} quick={false} hint="For an EMI that's already running, pick the date of the first instalment – paid ones are counted automatically." />
          <Text style={styles.label}>Remind me</Text>
          <ChipRow>
            {[0, 1, 2, 3, 5, 7].map((d) => (
              <Chip key={d} label={d === 0 ? 'On the day' : `${d} days before`} selected={remind === d} onPress={() => setRemind(d)} />
            ))}
          </ChipRow>
          <Button title={editing ? 'Save EMI' : 'Add EMI'} icon="checkmark" onPress={save} />
          {editing ? (
            <Button
              title="Delete EMI"
              variant="danger"
              icon="trash-outline"
              onPress={() =>
                ask('Delete this EMI?', 'A converted card purchase goes back to being billed in full.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { deleteEmi(editing); reset(); } },
                ])
              }
            />
          ) : null}
          <Button title="Cancel" variant="secondary" onPress={close} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card gradient>
        <Text style={{ color: '#ffffffcc' }}>EMIs every month</Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{money(monthlyTotal)}</Text>
        <Text style={{ color: '#ffffffdd' }}>{money(remainingTotal)} still to pay across {active.length} EMI{active.length === 1 ? '' : 's'}</Text>
      </Card>

      {data.emis.length === 0 ? <Empty icon="calendar-number-outline" title="No EMIs yet" text="Add running loan or card EMIs here. To convert a new card purchase, switch on “Converted to EMI” when you add the expense." /> : null}

      {active.map((e) => {
        const st = emiStatus(e, on);
        const acc = data.accounts.find((a) => a.id === e.accountId)?.name;
        return (
          <Card key={e.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{e.name}</Text>
                <Text style={styles.itemSub}>{EMI_KIND_LABEL[e.kind]}{acc ? ` · ${acc}` : ''}{e.transactionId ? ' · converted purchase' : ''}</Text>
              </View>
              <Text style={styles.statValue}>{money(e.monthlyAmount)}</Text>
            </Row>
            <ProgressBar value={st.done / e.totalMonths} plain />
            <Text style={styles.itemSub}>
              {st.done} of {e.totalMonths} paid · {money(st.remainingAmount)} left · ends {formatShortDate(st.endDate)}
              {st.next ? ` · next ${formatShortDate(st.next)}` : ''}
              {st.totalInterest > 0 ? ` · total interest ${money(st.totalInterest)}` : ' · no-cost'}
            </Text>
            <ChipRow>
              <Chip label="Edit" icon="create-outline" onPress={() => edit(e)} />
              {!(e.kind === 'card_emi' && e.transactionId) ? <Chip label="Pay instalment" icon="wallet-outline" onPress={() => router.push(`/add?emiId=${e.id}`)} /> : null}
            </ChipRow>
          </Card>
        );
      })}

      {finished.length > 0 ? (
        <Card>
          <Text style={styles.label}>Completed</Text>
          {finished.map((e) => (
            <Text key={e.id} style={styles.itemSub} onPress={() => edit(e)}>✓ {e.name} – {money(e.principal)}</Text>
          ))}
        </Card>
      ) : null}

      <Button title="Add an EMI" icon="add" onPress={() => setAdding(true)} />
    </Screen>
  );
}
