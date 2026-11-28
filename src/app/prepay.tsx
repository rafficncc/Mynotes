import { useState } from 'react';
import { ask } from '../components/Dialog';
import { toast } from '../components/Toast';
import { SPENDABLE_TYPES } from '../logic/balances';
import { defaultPayAccount } from '../logic/payments';
import { toISODate } from '../logic/dates';
import { useStore } from '../store/useStore';
import { Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { emiStatus } from '../logic/emi';
import { prepayment } from '../logic/trackers';
import { notifyBalance, useAppData, useBalances, useMoney } from '../store/hooks';
import { colors } from '../theme';

const years = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} yr ${m % 12} mo` : `${m} mo`);

export default function Prepay() {
  const data = useAppData();
  const { money } = useMoney();
  const balances = useBalances();
  const loans = data.emis.filter((e) => e.kind === 'loan_emi' && !emiStatus(e, new Date()).finished);
  const [outstanding, setOutstanding] = useState('');
  const [rate, setRate] = useState('');
  const [emi, setEmi] = useState('');
  const [prepay, setPrepay] = useState('100000');
  const [planId, setPlanId] = useState('');
  const [choice, setChoice] = useState<'shorter' | 'lower'>('shorter');
  const [fromId, setFromId] = useState(defaultPayAccount(data.accounts) ?? '');
  const addTransaction = useStore((s) => s.addTransaction);
  const saveEmi = useStore((s) => s.saveEmi);

  const pick = (id: string) => {
    setPlanId(id);
    const e = data.emis.find((x) => x.id === id)!;
    const loanAcc = data.accounts.find((a) => a.id === e.accountId && a.type === 'loan');
    const st = emiStatus(e, new Date());
    // The loan account balance is the best "outstanding"; otherwise estimate from remaining instalments.
    const bal = loanAcc ? -(balances[loanAcc.id] ?? 0) : st.remainingAmount;
    setOutstanding(String(Math.round(Math.max(0, bal))));
    setRate(String(e.interestRate ?? loanAcc?.interestRate ?? ''));
    setEmi(String(e.monthlyAmount));
  };

  const o = parseFloat(outstanding) || 0;
  const r = parseFloat(rate) || 0;
  const e = parseFloat(emi) || 0;
  const p = parseFloat(prepay) || 0;
  const result = o && r && e && p ? prepayment(o, r, e, Math.min(p, o)) : null;
  const plan = data.emis.find((x) => x.id === planId);
  const loanAcc = plan ? data.accounts.find((a) => a.id === plan.accountId && a.type === 'loan') : undefined;

  // Part payment: money moves from the bank to the loan (so the loan balance drops), and the EMI plan
  // either ends earlier (same EMI) or keeps its end date with a lower EMI.
  const record = () => {
    if (!plan || !result) return;
    if (!loanAcc) return ask('Link this EMI to its loan', 'Open More → EMIs, edit this EMI and pick the loan account, so the part payment can reduce the loan balance.');
    const amount = Math.min(p, o);
    addTransaction({ type: 'transfer', amount, date: toISODate(new Date()), accountId: fromId, toAccountId: loanAcc.id, note: `Part payment – ${plan.name}` });
    const done = emiStatus(plan, new Date()).done;
    if (choice === 'shorter') saveEmi({ ...plan, totalMonths: Math.max(done + 1, plan.totalMonths - result.shorterTenure.monthsSaved) });
    else saveEmi({ ...plan, monthlyAmount: result.lowerEmi.emi });
    notifyBalance(fromId, `Part payment of ${money(amount)} recorded`);
    toast(choice === 'shorter' ? `${plan.name} now ends ${years(result.shorterTenure.monthsSaved)} sooner` : `${plan.name} EMI is now ${money(result.lowerEmi.emi)}`);
    setOutstanding(String(Math.round(o - amount)));
  };

  return (
    <Screen>
      {loans.length ? (
        <ChipRow>
          {loans.map((l) => (
            <Chip key={l.id} label={l.name} icon="document-text-outline" onPress={() => pick(l.id)} />
          ))}
        </ChipRow>
      ) : null}
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Loan outstanding" value={outstanding} onChangeText={setOutstanding} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Interest % / year" value={rate} onChangeText={setRate} keyboardType="decimal-pad" /></View>
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Current EMI" value={emi} onChangeText={setEmi} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Prepay amount" value={prepay} onChangeText={setPrepay} keyboardType="decimal-pad" /></View>
        </Row>
      </Card>

      {result && result.before.months === Infinity ? (
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <Text style={[styles.insightText, { color: colors.danger }]}>This EMI doesn’t even cover the monthly interest. Check the numbers.</Text>
        </Card>
      ) : result ? (
        <>
          <Card>
            <Text style={styles.itemSub}>Without prepaying: {years(result.before.months)} left, {money(result.before.interest)} interest.</Text>
          </Card>
          <SectionTitle title="Option 1: keep the EMI, finish earlier" />
          <Card style={{ backgroundColor: colors.successSoft }}>
            <Row>
              <Stat label="Interest saved" value={money(result.shorterTenure.interestSaved)} color={colors.success} />
              <Stat label="Loan ends sooner by" value={years(result.shorterTenure.monthsSaved)} />
            </Row>
          </Card>
          <SectionTitle title="Option 2: same end date, lower EMI" />
          <Card>
            <Row>
              <Stat label="New EMI" value={money(result.lowerEmi.emi)} />
              <Stat label="Interest saved" value={money(result.lowerEmi.interestSaved)} />
            </Row>
          </Card>
          <Text style={styles.hint}>
            Option 1 usually saves more. Check your bank’s prepayment charges; most floating-rate home loans have none. Keep an emergency fund before prepaying.
          </Text>

          {plan ? (
            <>
              <SectionTitle title="Made a part payment? Record it" />
              <Card style={{ gap: 10 }}>
                <Text style={styles.label}>After the part payment</Text>
                <ChipRow>
                  <Chip label="Keep EMI, finish earlier" icon="flag-outline" selected={choice === 'shorter'} onPress={() => setChoice('shorter')} />
                  <Chip label="Lower my EMI" icon="trending-down-outline" selected={choice === 'lower'} onPress={() => setChoice('lower')} />
                </ChipRow>
                <Text style={styles.label}>Paid from</Text>
                <ChipRow>
                  {data.accounts.filter((a) => !a.archived && SPENDABLE_TYPES.includes(a.type) && a.type !== 'credit_card').map((a) => (
                    <Chip key={a.id} label={`${a.name} (${money(balances[a.id] ?? 0)})`} selected={fromId === a.id} onPress={() => setFromId(a.id)} />
                  ))}
                </ChipRow>
                <Button title={`Record part payment of ${money(Math.min(p, o))}`} icon="checkmark" onPress={record} />
                <Text style={styles.hint}>
                  The loan balance drops by this amount{loanAcc ? ` (${loanAcc.name})` : ''}, and {plan.name} is updated: {choice === 'shorter' ? `${years(result.shorterTenure.monthsSaved)} fewer EMIs` : `new EMI ${money(result.lowerEmi.emi)}`}.
                </Text>
              </Card>
            </>
          ) : (
            <Text style={styles.hint}>To record a part payment, pick your loan at the top.</Text>
          )}
        </>
      ) : (
        <Text style={styles.hint}>Fill in the loan details{loans.length ? ' or pick a loan above' : ''}.</Text>
      )}
    </Screen>
  );
}
