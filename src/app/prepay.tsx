import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip, ChipRow, Field, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { emiStatus } from '../logic/emi';
import { prepayment } from '../logic/trackers';
import { useAppData, useBalances, useMoney } from '../store/hooks';
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

  const pick = (id: string) => {
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
        </>
      ) : (
        <Text style={styles.hint}>Fill in the loan details{loans.length ? ' or pick a loan above' : ''}.</Text>
      )}
    </Screen>
  );
}
