import { ask } from '../components/Dialog';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { Button, Card, Chip, ChipRow, Field, HeaderAdd, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { diffDays, formatShortDate, parseDate, toISODate } from '../logic/dates';
import { BILL_TYPES, FREQUENCY_LABEL, billTypeInfo, detectSubscriptions, nextBillDate } from '../logic/recurring';
import type { Bill, BillType, Frequency } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const REMIND = [0, 1, 2, 3, 5, 7, 15, 30];
const FREQS: Frequency[] = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'once'];

export default function Bills() {
  const data = useAppData();
  const { saveBill, deleteBill } = useStore();
  const { money } = useMoney();
  const on = new Date();

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const formOpen = adding || !!editing;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Add a bill or reminder" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);
  const [type, setType] = useState<BillType>('mobile');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [dueDate, setDueDate] = useState(toISODate(on));
  const [remind, setRemind] = useState(3);
  const [reference, setReference] = useState('');

  const bills = useMemo(
    () =>
      data.bills
        .map((b) => ({ b, due: nextBillDate(b, on) }))
        .sort((x, y) => (x.due?.getTime() ?? Infinity) - (y.due?.getTime() ?? Infinity)),
    [data.bills], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const subs = useMemo(() => detectSubscriptions(data.transactions), [data.transactions]);
  const groups = [
    { title: 'Mobile & internet', types: ['mobile', 'internet'] },
    { title: 'Home & utilities', types: ['electricity', 'water', 'gas', 'rent', 'school', 'insurance', 'subscription', 'other'] },
    { title: 'Government: tax, fines & fees', types: ['tax', 'fine', 'government'] },
  ];

  const edit = (b: Bill) => {
    setEditing(b.id);
    setType(b.type);
    setName(b.name);
    setAmount(String(b.amount));
    setFrequency(b.frequency);
    setDueDate(b.dueDate);
    setRemind(b.remindDaysBefore);
    setReference(b.reference ?? '');
  };
  const reset = () => {
    setEditing(null);
    setAdding(false);
    setName('');
    setAmount('');
    setReference('');
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return ask('Enter the bill amount');
    if (!dueDate) return ask('Pick the due date');
    const t = billTypeInfo(type);
    const existing = data.bills.find((b) => b.id === editing);
    saveBill({
      id: editing ?? undefined,
      name: name.trim() || t.label,
      type,
      amount: amt,
      frequency,
      dueDate,
      remindDaysBefore: remind,
      reference: reference.trim() || undefined,
      categoryId: t.categoryId,
      lastPaid: existing?.dueDate === dueDate ? existing?.lastPaid : undefined,
    });
    reset();
  };

  const soon = bills.filter(({ due }) => due && diffDays(due, on) <= 30);
  if (formOpen) {
    return (
      <Screen>
        <SectionTitle title={editing ? 'Edit bill' : 'Add a bill'} />
        <Card>
          <ChipRow>
            {BILL_TYPES.map((t) => (
              <Chip key={t.key} label={t.label} icon={t.icon} selected={type === t.key} onPress={() => setType(t.key)} />
            ))}
          </ChipRow>
          <Field label="Name" value={name} onChangeText={setName} placeholder={billTypeInfo(type).label} hint="Use the same name as the shop/merchant when you log the payment – it'll be ticked off automatically." />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" /></View>
            <View style={{ flex: 1 }}><Field label={type === 'mobile' ? 'Mobile number' : type === 'fine' ? 'Challan / reason' : 'Reference (optional)'} value={reference} onChangeText={setReference} placeholder={type === 'mobile' ? '98xxxxxx21' : 'Account / consumer no.'} /></View>
          </Row>
          <Text style={styles.label}>How often</Text>
          <ChipRow>
            {FREQS.map((f) => (
              <Chip key={f} label={FREQUENCY_LABEL[f]} selected={frequency === f} onPress={() => setFrequency(f)} />
            ))}
          </ChipRow>
          <DateField label={frequency === 'once' ? 'Due date' : 'Next due date'} value={dueDate} onChange={setDueDate} quick={false} />
          <Text style={styles.label}>Remind me</Text>
          <ChipRow>
            {REMIND.map((d) => (
              <Chip key={d} label={d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'} before`} selected={remind === d} onPress={() => setRemind(d)} />
            ))}
          </ChipRow>
          <Button title={editing ? 'Save bill' : 'Add bill'} icon="checkmark" onPress={save} />
          {editing ? (
            <>
              <Button title="Pay & record now" variant="secondary" icon="wallet-outline" onPress={() => router.push(`/add?type=expense&billId=${editing}`)} />
              <Button
                title="Delete bill"
                variant="danger"
                icon="trash-outline"
                onPress={() =>
                  ask('Delete this bill?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { deleteBill(editing); reset(); } },
                  ])
                }
              />
            </>
          ) : null}
          <Button title="Cancel" variant="secondary" onPress={reset} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {bills.length ? (
        <Card gradient>
          <Row>
            <Stat light label="Bills tracked" value={`${bills.length}`} />
            <Stat light label="Due in 30 days" value={`${soon.length}`} color={colors.warning} />
            <Stat light label="Amount due" value={money(soon.reduce((s, { b }) => s + b.amount, 0))} color={colors.danger} />
          </Row>
          {bills[0].due ? (
            <Text style={{ color: '#ffffffb3', fontSize: 12 }}>
              Next: {bills[0].b.name} on {formatShortDate(bills[0].due)}
            </Text>
          ) : null}
        </Card>
      ) : null}
      {groups.map((g) => {
        const list = bills.filter(({ b }) => g.types.includes(b.type));
        if (!list.length) return null;
        return (
          <View key={g.title} style={{ gap: 8 }}>
            <SectionTitle title={g.title} />
            <Card>
              {list.map(({ b, due }) => {
                const days = due ? diffDays(due, on) : null;
                const t = billTypeInfo(b.type);
                return (
                  <ListItem
                    key={b.id}
                    icon={t.icon}
                    iconColor={days === null ? colors.success : days < 0 ? colors.danger : days <= b.remindDaysBefore ? colors.warning : colors.primary}
                    title={b.name}
                    subtitle={
                      due
                        ? `${days! < 0 ? `Overdue since ${formatShortDate(due)}` : `Next due ${formatShortDate(due)}`} · ${FREQUENCY_LABEL[b.frequency]} · remind ${b.remindDaysBefore}d before${b.reference ? ` · ${b.reference}` : ''}`
                        : `Paid on ${formatShortDate(parseDate(b.lastPaid!))}`
                    }
                    right={money(b.amount)}
                    onPress={() => edit(b)}
                  />
                );
              })}
            </Card>
          </View>
        );
      })}
      {bills.length === 0 ? <Card><Text style={styles.itemSub}>Add mobile, internet, electricity, taxes, fines and other bills. FamilyFin reminds you before each due date.</Text></Card> : null}

      <Button title="Add a bill or reminder" icon="add" onPress={() => setAdding(true)} />

      <SectionTitle title="Detected recurring charges" />
      <Card>
        {subs.length === 0 ? (
          <Text style={styles.itemSub}>Charges of a similar amount at the same merchant for 3+ months show up here.</Text>
        ) : (
          subs.map((s) => (
            <ListItem key={s.merchant} icon="repeat" iconColor={colors.info} title={s.merchant} subtitle={`${s.months} months · last ${formatShortDate(parseDate(s.lastDate))}`} right={money(s.amount)} />
          ))
        )}
      </Card>
    </Screen>
  );
}
