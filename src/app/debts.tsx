import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { premiumOnly } from '../components/PremiumGate';
import { Card, Chip, ChipRow, Empty, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { listDebts, payoffPlan, type Method } from '../logic/debt';
import { addMonths } from '../logic/dates';
import { personBalances } from '../logic/money2';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { colors } from '../theme';

const monthName = (n: number) => addMonths(new Date(), n, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
const KIND_ICON = { card: 'card', loan: 'document-text-outline', person: 'people-outline' } as const;

/** Which debt to clear first, and when the family will be debt-free. */
function Debts() {
  const data = useAppData();
  const balances = useBalances();
  const { money } = useMoney();
  const [extra, setExtra] = useState('');
  const [method, setMethod] = useState<Method>('avalanche');
  const debts = useMemo(() => listDebts(data.accounts, balances, data.emis, personBalances(data.transactions)), [data, balances]);
  const extraAmt = parseFloat(extra) || 0;
  const plan = useMemo(() => payoffPlan(debts, extraAmt, method), [debts, extraAmt, method]);
  const other = useMemo(() => payoffPlan(debts, extraAmt, method === 'avalanche' ? 'snowball' : 'avalanche'), [debts, extraAmt, method]);
  const base = useMemo(() => payoffPlan(debts, 0, method), [debts, method]);
  const total = debts.reduce((s, d) => s + d.balance, 0);
  const monthly = debts.reduce((s, d) => s + d.minPayment, 0) + extraAmt;

  if (!debts.length) return <Screen><Empty icon="happy-outline" title="No debts. Well done!" text="Credit card balances, loans and money you borrowed from people will appear here." /></Screen>;

  return (
    <Screen>
      <Card>
        <Row>
          <Stat label="Total debt" value={money(total)} color={colors.danger} />
          <Stat label="Paying each month" value={money(monthly)} />
        </Row>
        <Text style={[styles.itemTitle, { color: plan.months === null ? colors.danger : colors.success }]}>
          {plan.months === null ? 'At this payment the interest grows faster than you pay. Add an extra amount below.' : `Debt-free by ${monthName(plan.months)} · interest ${money(plan.totalInterest)}`}
        </Text>
      </Card>

      <Card>
        <Field label="Extra I can pay each month (on top of minimums)" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" placeholder="e.g. 5000" />
        {extraAmt > 0 && plan.months !== null && base.months !== null && base.months > plan.months ? (
          <Text style={[styles.insightText, { color: colors.success, fontWeight: '700' }]}>
            {money(extraAmt)} extra makes you debt-free {base.months - plan.months} months sooner and saves {money(base.totalInterest - plan.totalInterest)} interest.
          </Text>
        ) : null}
        <ChipRow>
          <Chip label="Highest interest first" icon="trending-down-outline" selected={method === 'avalanche'} onPress={() => setMethod('avalanche')} />
          <Chip label="Smallest debt first" icon="podium-outline" selected={method === 'snowball'} onPress={() => setMethod('snowball')} />
        </ChipRow>
        <Text style={styles.hint}>
          {method === 'avalanche'
            ? 'Clears the costliest debt first. Saves the most money.'
            : 'Clears small debts first. Quick wins keep you motivated.'}
          {plan.months !== null && other.months !== null && other.totalInterest !== plan.totalInterest
            ? ` The other way costs ${money(Math.abs(other.totalInterest - plan.totalInterest))} ${other.totalInterest > plan.totalInterest ? 'more' : 'less'} in interest.`
            : ''}
        </Text>
      </Card>

      <SectionTitle title="Clear them in this order" />
      <Card>
        {plan.steps.map((s, i) => {
          const d = debts.find((x) => x.id === s.id)!;
          return (
            <ListItem
              key={s.id}
              icon={KIND_ICON[d.kind]}
              iconColor={i === 0 ? colors.danger : colors.muted}
              title={`${i + 1}. ${d.name}`}
              subtitle={`${d.rate}% interest${d.rateAssumed ? ' (assumed – tap to set)' : ''} · minimum ${money(d.minPayment)}/month`}
              right={money(d.balance)}
              rightSub={`paid off ${monthName(s.month)}`}
              rightColor={colors.danger}
              onPress={d.kind === 'person' ? () => router.push(`/person?name=${encodeURIComponent(d.name)}`) : () => router.push(`/account-form?id=${d.id}`)}
            />
          );
        })}
        {plan.months === null ? <Text style={styles.hint}>Some debts can’t be cleared at the current payment.</Text> : null}
      </Card>

      <Card style={{ backgroundColor: colors.infoSoft }}>
        <View style={{ gap: 4 }}>
          <Text style={styles.itemTitle}>How to use this</Text>
          <Text style={styles.insightText}>1. Always pay the minimum on every debt, so you never pay late fees.</Text>
          <Text style={styles.insightText}>2. Put every extra rupee on debt no. 1 until it is gone.</Text>
          <Text style={styles.insightText}>3. Then add what you paid on it to debt no. 2, and so on.</Text>
          <Text style={styles.hint}>Interest rates marked “assumed” use typical rates. Tap the debt and enter the rate from your statement for an exact plan.</Text>
        </View>
      </Card>
    </Screen>
  );
}

export default premiumOnly(Debts, 'Debt payoff planner', 'See which debt to clear first, how much extra to pay, and the date your family becomes debt-free.');
