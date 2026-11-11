import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Field, ListItem, Row, Screen, SectionTitle, styles } from '../components/ui';
import { diffDays, formatShortDate, parseDate } from '../logic/dates';
import { billPaidRecently, detectSubscriptions, nextBillDate } from '../logic/recurring';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Bills() {
  const data = useAppData();
  const { addBill, deleteBill } = useStore();
  const { money } = useMoney();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const on = new Date();

  const bills = useMemo(
    () =>
      data.bills
        .map((b) => ({ b, due: nextBillDate(b, on), paid: billPaidRecently(b, data.transactions, on) }))
        .sort((x, y) => x.due.getTime() - y.due.getTime()),
    [data.bills, data.transactions], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const subs = useMemo(() => detectSubscriptions(data.transactions), [data.transactions]);
  const subTotal = subs.reduce((s, x) => s + x.amount, 0);

  const add = () => {
    const amt = parseFloat(amount);
    const day = parseInt(dueDay, 10);
    if (!name.trim() || !amt || !(day >= 1 && day <= 31)) return Alert.alert('Enter name, amount and due day (1–31)');
    addBill({ name: name.trim(), amount: amt, dueDay: day });
    setName('');
    setAmount('');
    setDueDay('');
  };

  return (
    <Screen>
      <SectionTitle title="Upcoming bills" />
      <Card>
        {bills.length === 0 ? <Text style={styles.itemSub}>Add rent, EMI, electricity, school fees, insurance… and never miss a due date.</Text> : null}
        {bills.map(({ b, due, paid }) => {
          const days = diffDays(due, on);
          return (
            <ListItem
              key={b.id}
              icon={paid ? 'checkmark-circle' : 'receipt-outline'}
              iconColor={paid ? colors.success : days <= 3 ? colors.danger : colors.warning}
              title={b.name}
              subtitle={paid ? 'Paid this cycle' : `Due ${formatShortDate(due)} · ${days === 0 ? 'today' : `in ${days} days`}`}
              right={money(b.amount)}
              onPress={() =>
                Alert.alert(`Delete ${b.name}?`, undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteBill(b.id) },
                ])
              }
            />
          );
        })}
      </Card>
      <Card>
        <Field label="Bill name" value={name} onChangeText={setName} placeholder="e.g. Electricity, Car EMI" hint="Use the same name as the shop/merchant when you log the payment – it'll be marked paid automatically." />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="2000" /></View>
          <View style={{ flex: 1 }}><Field label="Due day" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" placeholder="10" /></View>
        </Row>
        <Button title="Add bill" icon="add" onPress={add} />
      </Card>

      <SectionTitle title="Detected recurring charges" />
      <Card>
        {subs.length === 0 ? (
          <Text style={styles.itemSub}>Nothing detected yet. Charges of a similar amount at the same merchant for 3+ months show up here.</Text>
        ) : (
          <>
            <Text style={styles.insightText}>
              {money(subTotal)}/month · {money(subTotal * 12)}/year. Ask: did we use each of these last month?
            </Text>
            {subs.map((s) => (
              <ListItem key={s.merchant} icon="repeat" iconColor={colors.info} title={s.merchant} subtitle={`${s.months} months · last ${formatShortDate(parseDate(s.lastDate))}`} right={money(s.amount)} />
            ))}
          </>
        )}
      </Card>
    </Screen>
  );
}
