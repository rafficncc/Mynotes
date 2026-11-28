import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { toast } from '../components/Toast';
import { Button, Card, Chip, ChipRow, Empty, Field, Icon, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { SPENDABLE_TYPES } from '../logic/balances';
import { toISODate } from '../logic/dates';
import { emiStatus } from '../logic/emi';
import { defaultPayAccount } from '../logic/payments';
import { prepayment } from '../logic/trackers';
import { notifyBalance, useAppData, useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const years = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} yr${m % 12 ? ` ${m % 12} mo` : ''}` : `${m} mo`);

/** Pick a loan, enter a part payment (and any charges), see what it saves, then record it. */
export default function Prepay() {
  const data = useAppData();
  const { money } = useMoney();
  const balances = useBalances();
  const addTransaction = useStore((s) => s.addTransaction);
  const saveEmi = useStore((s) => s.saveEmi);
  const on = new Date();

  // Every loan: loan accounts (with their EMI if one is linked), plus loan EMIs not linked to an account.
  const plans = data.emis.filter((e) => e.kind === 'loan_emi' && !emiStatus(e, on).finished);
  const loans = [
    ...data.accounts
      .filter((a) => !a.archived && a.type === 'loan' && (balances[a.id] ?? 0) < 0)
      .map((a) => {
        const plan = plans.find((e) => e.accountId === a.id);
        return { key: a.id, name: a.name, accountId: a.id, plan, outstanding: -(balances[a.id] ?? 0), rate: plan?.interestRate ?? a.interestRate, emi: plan?.monthlyAmount };
      }),
    ...plans
      .filter((e) => !data.accounts.some((a) => a.id === e.accountId && a.type === 'loan'))
      .map((e) => ({ key: e.id, name: e.name, accountId: undefined, plan: e, outstanding: emiStatus(e, on).remainingAmount, rate: e.interestRate, emi: e.monthlyAmount })),
  ];

  const [key, setKey] = useState('');
  const loan = loans.find((l) => l.key === key);
  const [rate, setRate] = useState('');
  const [emi, setEmi] = useState('');
  const [amount, setAmount] = useState('');
  const [charges, setCharges] = useState('');
  const [chargeIn, setChargeIn] = useState<'amount' | 'percent'>('amount');
  const [date, setDate] = useState(toISODate(on));
  const [fromId, setFromId] = useState(defaultPayAccount(data.accounts) ?? '');
  const [choice, setChoice] = useState<'shorter' | 'lower'>('shorter');

  const pick = (k: string) => {
    const l = loans.find((x) => x.key === k)!;
    setKey(k);
    setRate(l.rate ? String(l.rate) : '');
    setEmi(l.emi ? String(l.emi) : '');
    setAmount('');
    setCharges('');
  };

  const o = loan?.outstanding ?? 0;
  const r = parseFloat(rate) || 0;
  const e = parseFloat(emi) || 0;
  const p = Math.min(parseFloat(amount) || 0, o);
  const fee = chargeIn === 'percent' ? Math.round((p * (parseFloat(charges) || 0)) / 100) : parseFloat(charges) || 0;
  const result = loan && r && e && p ? prepayment(o, r, e, p) : null;
  const plan = loan?.plan;

  // Part payment: bank → loan (the loan balance drops), charges as an expense, and the EMI plan
  // either ends earlier (same EMI) or keeps its end date with a lower EMI.
  const record = () => {
    if (!loan || !result) return;
    if (!loan.accountId) return ask('Link this EMI to its loan account', 'Add the loan under More → Accounts, then edit this EMI under More → EMIs and pick that loan, so the part payment can reduce the loan balance.');
    if (!fromId) return ask('Choose the account you paid from');
    addTransaction({ type: 'transfer', amount: p, date, accountId: fromId, toAccountId: loan.accountId, note: `Part payment – ${loan.name}` });
    if (fee) addTransaction({ type: 'expense', amount: fee, date, accountId: fromId, categoryId: 'emi', merchant: `${loan.name} prepayment charges` });
    if (plan) {
      const done = emiStatus(plan, on).done;
      if (choice === 'shorter') saveEmi({ ...plan, totalMonths: Math.max(done + 1, plan.totalMonths - result.shorterTenure.monthsSaved) });
      else saveEmi({ ...plan, monthlyAmount: result.lowerEmi.emi });
    }
    notifyBalance(fromId, `Part payment of ${money(p)} recorded`);
    toast(`${loan.name}: balance now ${money(o - p)}`);
    setAmount('');
    setCharges('');
  };

  if (!loans.length) return <Screen><Empty icon="document-text-outline" title="No loans yet" text="Add your loan under More → Accounts (and its EMI under More → EMIs) to plan a part payment." /></Screen>;

  return (
    <Screen>
      <Text style={styles.hint}>A part payment (prepayment) is extra money paid towards a loan on top of the EMI. It cuts the interest you pay.</Text>

      <Step n={1} title="Select the loan">
        {loans.map((l) => {
          const sel = l.key === key;
          return (
            <Pressable key={l.key} onPress={() => pick(l.key)} accessibilityRole="button" accessibilityState={{ selected: sel }} style={{ borderRadius: 16, borderWidth: 2, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primarySoft : colors.card, padding: 12, gap: 4 }}>
              <Row>
                <Icon name={sel ? 'radio-button-on' : 'radio-button-off'} color={sel ? colors.primary : colors.muted} />
                <Text style={[styles.itemTitle, { flex: 1 }]}>{l.name}</Text>
                <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 15 }}>{money(l.outstanding)}</Text>
              </Row>
              <Text style={[styles.hint, { marginLeft: 28 }]}>
                {[l.emi ? `EMI ${money(l.emi)}` : 'No EMI on file', l.rate ? `${l.rate}% interest` : 'rate not set', l.plan ? `${emiStatus(l.plan, on).remaining} EMIs left` : null].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          );
        })}
      </Step>

      {loan ? (
        <>
          {!loan.rate || !loan.emi ? (
            <Card style={{ gap: 6 }}>
              <Text style={styles.itemSub}>Fill in what’s missing for this loan:</Text>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}><Field label="Interest % / year" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 9" /></View>
                <View style={{ flex: 1 }}><Field label="Monthly EMI" value={emi} onChangeText={setEmi} keyboardType="decimal-pad" placeholder="e.g. 12500" /></View>
              </Row>
            </Card>
          ) : null}

          <Step n={2} title="Part payment details">
            <Card style={{ gap: 10 }}>
              <Field label="Part payment amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={`Up to ${money(o)}`} />
              <Text style={styles.label}>Prepayment charges (if any)</Text>
              <ChipRow>
                <Chip label="Amount" icon="cash-outline" selected={chargeIn === 'amount'} onPress={() => { setChargeIn('amount'); setCharges(''); }} />
                <Chip label="% of part payment" icon="pie-chart-outline" selected={chargeIn === 'percent'} onPress={() => { setChargeIn('percent'); setCharges(''); }} />
              </ChipRow>
              <Field
                label={chargeIn === 'percent' ? 'Charge %' : 'Charge amount'}
                value={charges}
                onChangeText={setCharges}
                keyboardType="decimal-pad"
                placeholder={chargeIn === 'percent' ? 'e.g. 2' : '0'}
                hint={chargeIn === 'percent' && fee ? `= ${money(fee)} on ${money(p)}` : 'Fee or penalty your bank charges. Many floating-rate loans have none; fixed-rate loans often charge 1–3%.'}
              />
              <DateField label="Date paid" value={date} onChange={setDate} />
              <Text style={styles.label}>Paid from</Text>
              <ChipRow>
                {data.accounts.filter((a) => !a.archived && SPENDABLE_TYPES.includes(a.type) && a.type !== 'credit_card' && !(a.type === 'debit_card' && a.linkedBankId)).map((a) => (
                  <Chip key={a.id} label={`${a.name} (${money(balances[a.id] ?? 0)})`} selected={fromId === a.id} onPress={() => setFromId(a.id)} />
                ))}
              </ChipRow>
            </Card>
          </Step>

          {result && result.before.months === Infinity ? (
            <Card style={{ backgroundColor: colors.dangerSoft }}>
              <Text style={[styles.insightText, { color: colors.danger }]}>This EMI doesn’t cover the monthly interest. Check the rate and EMI.</Text>
            </Card>
          ) : result ? (
            <Step n={3} title="After the part payment">
              <Text style={styles.hint}>Today: {years(result.before.months)} of EMIs left and {money(result.before.interest)} interest to pay.</Text>
              <OptionCard
                selected={choice === 'shorter'}
                onPress={() => setChoice('shorter')}
                icon="flag-outline"
                title="Keep the EMI, finish earlier"
                badge="Saves more"
                stats={[['You save', money(result.shorterTenure.interestSaved - fee)], ['Loan ends', `${years(result.shorterTenure.monthsSaved)} sooner`]]}
              />
              <OptionCard
                selected={choice === 'lower'}
                onPress={() => setChoice('lower')}
                icon="trending-down-outline"
                title="Same end date, lower EMI"
                stats={[['You save', money(result.lowerEmi.interestSaved - fee)], ['New EMI', money(result.lowerEmi.emi)]]}
              />
              {fee ? <Text style={styles.hint}>Savings shown after the {money(fee)} charges.</Text> : null}
            </Step>
          ) : (
            <Text style={[styles.hint, { textAlign: 'center' }]}>Enter the part payment amount to see what it saves.</Text>
          )}

          {result && result.before.months !== Infinity ? (
            <Step n={4} title="Record it">
              <Card gradient style={{ gap: 6 }}>
                <Row>
                  <Stat light label="Pay now" value={money(p + fee)} />
                  <Stat light label="New loan balance" value={money(o - p)} color={colors.success} />
                </Row>
                <Text style={{ color: '#ffffffb3', fontSize: 12 }}>
                  {money(p)} goes to {loan.name}
                  {fee ? `, ${money(fee)} charges as an expense` : ''}
                  {plan ? `. EMI plan: ${choice === 'shorter' ? `${years(result.shorterTenure.monthsSaved)} fewer EMIs` : `new EMI ${money(result.lowerEmi.emi)}`}.` : '.'}
                </Text>
              </Card>
              <Button title="Record part payment" icon="checkmark" onPress={record} />
            </Step>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ gap: 8, marginTop: 4 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{n}</Text>
        </View>
        <SectionTitle title={title} />
      </Row>
      {children}
    </View>
  );
}

function OptionCard({ selected, onPress, icon, title, badge, stats }: { selected: boolean; onPress: () => void; icon: string; title: string; badge?: string; stats: [string, string][] }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ borderRadius: 16, borderWidth: 2, borderColor: selected ? colors.success : colors.border, backgroundColor: selected ? colors.successSoft : colors.card, padding: 12, gap: 8 }}>
      <Row>
        <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} color={selected ? colors.success : colors.muted} />
        <Icon name={icon} size={16} color={colors.text} />
        <Text style={[styles.itemTitle, { flex: 1 }]}>{title}</Text>
        {badge ? <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800' }}>{badge}</Text> : null}
      </Row>
      <Row>
        {stats.map(([l, v]) => (
          <Stat key={l} label={l} value={v} color={l === 'You save' ? colors.success : undefined} />
        ))}
      </Row>
    </Pressable>
  );
}
