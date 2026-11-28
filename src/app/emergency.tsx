import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Gauge } from '../components/charts';
import { ask } from '../components/Dialog';
import { GradientBg } from '../components/GradientBg';
import { toast } from '../components/Toast';
import { TxnRow } from '../components/TxnRow';
import { Button, Card, Chip, ChipRow, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { ACCOUNT_TYPE_ICON, canPayFrom } from '../logic/balances';
import { toISODate } from '../logic/dates';
import { safetyNet } from '../logic/insights';
import { notifyBalance, useAppData, useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const TEAL: [string, string] = ['#0B5450', '#14918B'];

/** The family's emergency fund: kept apart, with a target, top-ups and an automatic monthly top-up. Free. */
export default function Emergency() {
  const data = useAppData();
  const balances = useBalances();
  const { money } = useMoney();
  const { updateSettings, updateAccount, addTransaction } = useStore();
  const funds = data.accounts.filter((a) => a.emergency && !a.archived);
  const payers = data.accounts.filter((a) => !a.archived && canPayFrom(a) && a.type !== 'credit_card' && !(a.type === 'debit_card' && a.linkedBankId));
  const candidates = data.accounts.filter((a) => !a.archived && !a.emergency && ['bank', 'cash', 'wallet', 'deposit'].includes(a.type));
  const net = safetyNet(data).emergency;
  const auto = data.settings.emergencyAuto;
  const [amount, setAmount] = useState('');
  const [fromId, setFromId] = useState(payers.find((a) => a.type === 'bank')?.id ?? payers[0]?.id ?? '');
  const [toId, setToId] = useState(funds[0]?.id ?? '');
  const [autoAmt, setAutoAmt] = useState('');
  const [autoDay, setAutoDay] = useState('1');
  const into = funds.find((f) => f.id === toId) ?? funds[0];
  const left = Math.max(0, net.target - net.amount);
  const history = data.transactions
    .filter((t) => funds.some((f) => f.id === t.accountId || f.id === t.toAccountId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  const topUp = () => {
    const amt = parseFloat(amount);
    if (!amt || !into || !fromId) return ask('Enter an amount and choose where it comes from');
    addTransaction({ type: 'transfer', amount: amt, date: toISODate(new Date()), accountId: fromId, toAccountId: into.id, note: 'Emergency fund top-up' });
    notifyBalance(into.id, `Added ${money(amt)} to your emergency fund`);
    setAmount('');
  };
  const saveAuto = () => {
    const amt = parseFloat(autoAmt);
    const day = parseInt(autoDay, 10);
    if (!amt || !(day >= 1 && day <= 31) || !into || !fromId) return ask('Enter the monthly amount and a day from 1 to 31');
    // Start next month (or this month if the day is still ahead), so nothing is back-filled today.
    const now = new Date();
    const last = now.getDate() >= day ? toISODate(new Date(now.getFullYear(), now.getMonth(), day)) : undefined;
    updateSettings({ emergencyAuto: { amount: amt, day, fromId, toId: into.id, last } });
    toast(`${money(amt)} will be added on day ${day} every month`);
    setAutoAmt('');
  };
  const withdraw = (id: string) =>
    ask('Use the emergency fund?', 'Only for real emergencies: job loss, medical bills, urgent repairs. Not for holidays or sales. Remember to refill it afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, it’s an emergency', onPress: () => router.push(`/add?type=transfer&accountId=${id}`) },
    ]);

  return (
    <Screen>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <GradientBg id="efbg" colors={TEAL} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff10', top: -80, right: -60 }} />
        <View style={{ padding: 16, gap: 12 }}>
          <Row style={{ gap: 16 }}>
            <Gauge value={net.target ? net.amount / net.target : 0} size={104} label={net.target ? `${Math.min(999, Math.round((net.amount / net.target) * 100))}%` : '–'} sub="of target" light />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Emergency fund</Text>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{money(net.amount)}</Text>
              <Text style={{ color: '#ffffffd9', fontSize: 13 }}>Target {money(net.target)} · {net.goal} months</Text>
              <Text style={{ color: left ? '#FFD978' : '#7EE3B5', fontSize: 14, fontWeight: '800' }}>{left ? `${net.months.toFixed(1)} months covered · ${money(left)} to go` : 'Target reached. Well done!'}</Text>
            </View>
          </Row>
          {left && net.target ? <Text style={{ color: '#ffffffd9', fontSize: 12 }}>💡 Add {money(Math.ceil(left / 12 / 100) * 100)} a month to reach it in a year.</Text> : null}
        </View>
      </View>

      <Text style={styles.label}>Target: months of expenses to keep</Text>
      <ChipRow>
        {[3, 6, 9, 12].map((m) => (
          <Chip key={m} label={`${m} months`} selected={net.goal === m} onPress={() => updateSettings({ emergencyMonths: m })} />
        ))}
      </ChipRow>

      {funds.length === 0 ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.itemTitle}>Set up your emergency fund</Text>
          <Text style={styles.itemSub}>Keep it in its own place, for example a separate savings account or an FD, so it isn’t spent by mistake. FamilyFin leaves it out of your spendable money and payment choices.</Text>
          <Button title="Create an emergency fund account" icon="add" onPress={() => router.push('/account-form?type=bank&emergency=1')} />
          {candidates.length ? (
            <>
              <Text style={styles.label}>…or use an account you already have</Text>
              <ChipRow>
                {candidates.map((a) => (
                  <Chip key={a.id} label={`${a.name} (${money(balances[a.id] ?? 0)})`} icon={ACCOUNT_TYPE_ICON[a.type]} onPress={() => { updateAccount(a.id, { emergency: true }); setToId(a.id); toast(`${a.name} is now your emergency fund`); }} />
                ))}
              </ChipRow>
            </>
          ) : null}
        </Card>
      ) : (
        <>
          <SectionTitle title="Where it’s kept" />
          <Card style={{ gap: 0 }}>
            {funds.map((a) => (
              <ListItem key={a.id} icon={ACCOUNT_TYPE_ICON[a.type]} iconColor={TEAL[1]} title={a.name} subtitle="Tap to edit · kept untouched" right={money(balances[a.id] ?? 0)} onPress={() => router.push(`/account-form?id=${a.id}`)} />
            ))}
          </Card>

          <SectionTitle title="Top up" />
          <Card style={{ gap: 10 }}>
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 10000" />
            <Text style={styles.label}>From</Text>
            <ChipRow>
              {payers.map((a) => (
                <Chip key={a.id} label={`${a.name} (${money(balances[a.id] ?? 0)})`} selected={fromId === a.id} onPress={() => setFromId(a.id)} />
              ))}
            </ChipRow>
            {funds.length > 1 ? (
              <ChipRow>
                {funds.map((a) => (
                  <Chip key={a.id} label={`Into ${a.name}`} selected={into?.id === a.id} onPress={() => setToId(a.id)} />
                ))}
              </ChipRow>
            ) : null}
            <Button title="Top up now" icon="arrow-down-circle-outline" onPress={topUp} />
          </Card>

          <SectionTitle title="Automatic monthly top-up" />
          <Card style={{ gap: 10 }}>
            {auto ? (
              <>
                <Row>
                  <Stat label="Every month" value={money(auto.amount)} color={colors.success} />
                  <Stat label="On day" value={String(auto.day)} />
                </Row>
                <Text style={styles.hint}>From {data.accounts.find((a) => a.id === auto.fromId)?.name ?? 'your bank'} into {data.accounts.find((a) => a.id === auto.toId)?.name ?? 'the fund'}. Recorded automatically when the day comes.</Text>
                <Button title="Stop automatic top-up" variant="secondary" onPress={() => updateSettings({ emergencyAuto: undefined })} />
              </>
            ) : (
              <>
                <Text style={styles.hint}>Pay yourself first: move a fixed amount into the fund every month, right after salary day.</Text>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 2 }}><Field label="Amount each month" value={autoAmt} onChangeText={setAutoAmt} keyboardType="decimal-pad" placeholder={left ? String(Math.ceil(left / 12 / 100) * 100) : '5000'} /></View>
                  <View style={{ flex: 1 }}><Field label="Day" value={autoDay} onChangeText={setAutoDay} keyboardType="number-pad" placeholder="1-31" /></View>
                </Row>
                <Button title="Set up automatic top-up" variant="secondary" icon="repeat" onPress={saveAuto} />
              </>
            )}
          </Card>

          <Button title="Use the fund for an emergency" variant="danger" icon="alert-circle-outline" onPress={() => withdraw(into!.id)} />

          {history.length ? (
            <>
              <SectionTitle title="History" />
              <Card>
                {history.map((t) => (
                  <TxnRow key={t.id} t={t} accounts={data.accounts} categories={data.categories} money={money} />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}

      <Card style={{ backgroundColor: colors.infoSoft, gap: 4 }}>
        <Text style={styles.itemTitle}>What counts as an emergency?</Text>
        <Text style={styles.insightText}>✅ Job loss, medical bills, urgent home or car repairs, a family crisis.</Text>
        <Text style={styles.insightText}>❌ Holidays, sales, gadgets, festivals. Plan those with Savings goals instead.</Text>
      </Card>
    </Screen>
  );
}
