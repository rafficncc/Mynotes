import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { premiumOnly } from '../components/PremiumGate';
import { Card, Chip, ChipRow, Empty, Field, Icon, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
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
  const [method, setMethod] = useState<Method>('snowball');
  const debts = useMemo(() => listDebts(data.accounts, balances, data.emis, personBalances(data.transactions)), [data, balances]);
  const extraAmt = parseFloat(extra) || 0;
  const plan = useMemo(() => payoffPlan(debts, extraAmt, method), [debts, extraAmt, method]);
  const other = useMemo(() => payoffPlan(debts, extraAmt, method === 'avalanche' ? 'snowball' : 'avalanche'), [debts, extraAmt, method]);
  const base = useMemo(() => payoffPlan(debts, 0, method), [debts, method]);
  const total = debts.reduce((s, d) => s + d.balance, 0);
  const monthly = debts.reduce((s, d) => s + d.minPayment, 0) + extraAmt;

  if (!debts.length) return <Screen><Empty icon="happy-outline" title="No debts. Well done!" text="Credit card balances, loans and money you borrowed from people will appear here." /></Screen>;

  const start = debts.reduce((s2, d) => s2 + d.minPayment, 0) + extraAmt;

  return (
    <Screen>
      {/* Where the journey ends */}
      <Card gradient>
        <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Your debt-free journey</Text>
        <Text style={{ color: plan.months === null ? '#FF9E8A' : '#fff', fontSize: 26, fontWeight: '900' }}>
          {plan.months === null ? 'Not reachable yet' : `Debt-free by ${monthName(plan.months)}`}
        </Text>
        <Row>
          <Stat light label="Total debt" value={money(total)} color={colors.danger} />
          <Stat light label="Paying monthly" value={money(monthly)} />
          <Stat light label="Milestones" value={`${plan.steps.length}`} color={colors.warning} />
        </Row>
        <Text style={{ color: '#ffffffb3', fontSize: 12 }}>
          {plan.months === null ? 'At this payment the interest grows faster than you pay. Add an extra amount below.' : `${plan.months} months away · interest on the way ${money(plan.totalInterest)}`}
        </Text>
      </Card>

      <Card>
        <Field label="Extra I can pay each month (on top of minimums)" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" placeholder="e.g. 5000" />
        {extraAmt > 0 && plan.months !== null && base.months !== null && base.months > plan.months ? (
          <Text style={[styles.insightText, { color: colors.success, fontWeight: '700' }]}>
            🚀 {money(extraAmt)} extra gets you there {base.months - plan.months} months sooner and saves {money(base.totalInterest - plan.totalInterest)} interest.
          </Text>
        ) : null}
        <ChipRow>
          <Chip label="Snowball: smallest first" icon="snow-outline" selected={method === 'snowball'} onPress={() => setMethod('snowball')} />
          <Chip label="Avalanche: costliest first" icon="trending-down-outline" selected={method === 'avalanche'} onPress={() => setMethod('avalanche')} />
        </ChipRow>
        <Text style={styles.hint}>
          {method === 'snowball'
            ? 'Clear the smallest debt first for a quick win, then roll its payment into the next one. The payment grows like a snowball.'
            : 'Clear the costliest debt first. Saves the most interest.'}
          {plan.months !== null && other.months !== null && other.totalInterest !== plan.totalInterest
            ? ` The other way costs ${money(Math.abs(other.totalInterest - plan.totalInterest))} ${other.totalInterest > plan.totalInterest ? 'more' : 'less'} in interest.`
            : ''}
        </Text>
      </Card>

      <SectionTitle title="The journey" />
      <View>
        <Milestone color="#5B6B7A" icon="walk" title="Today: the start" sub={`${debts.length} debt${debts.length === 1 ? '' : 's'} · ${money(total)} to clear`} note={`You put ${money(start)} a month towards debts`} first />
        {plan.steps.map((st, i) => {
          const d = debts.find((x) => x.id === st.id)!;
          // What has been cleared so far, and how big the snowball payment has become.
          const clearedSoFar = plan.steps.slice(0, i + 1).reduce((s2, x) => s2 + debts.find((y) => y.id === x.id)!.balance, 0);
          const rolled = extraAmt + plan.steps.slice(0, i + 1).reduce((s2, x) => s2 + debts.find((y) => y.id === x.id)!.minPayment, 0);
          const next = plan.steps[i + 1] ? debts.find((y) => y.id === plan.steps[i + 1].id) : undefined;
          const pct = Math.round((clearedSoFar / total) * 100);
          return (
            <Milestone
              key={st.id}
              color={STOP_COLORS[Math.min(i, STOP_COLORS.length - 1)]}
              icon={KIND_ICON[d.kind]}
              step={i + 1}
              title={`Clear ${d.name}`}
              sub={`${money(d.balance)} · ${d.rate}% interest${d.rateAssumed ? ' (assumed)' : ''} · ${monthName(st.month)} (month ${st.month})`}
              note={next ? `🎉 Then ${money(rolled)} a month rolls into ${next.name}` : undefined}
              pct={pct}
              onPress={d.kind === 'person' ? () => router.push(`/person?name=${encodeURIComponent(d.name)}`) : () => router.push(`/account-form?id=${d.id}`)}
            />
          );
        })}
        {plan.months !== null ? (
          <Milestone color="#14915F" icon="trophy" title={`Debt-free! ${monthName(plan.months)}`} sub={`All ${money(total)} cleared · ${money(plan.totalInterest)} interest on the way`} note="Keep paying yourself the same amount into savings" last />
        ) : (
          <Text style={[styles.hint, { color: colors.danger }]}>Some debts can’t be cleared at the current payment. Add an extra amount above.</Text>
        )}
      </View>

      <Card style={{ backgroundColor: colors.infoSoft }}>
        <View style={{ gap: 4 }}>
          <Text style={styles.itemTitle}>How the snowball works</Text>
          <Text style={styles.insightText}>1. Pay the minimum on every debt, so there are no late fees.</Text>
          <Text style={styles.insightText}>2. Put every extra rupee on milestone 1 until it is gone.</Text>
          <Text style={styles.insightText}>3. Roll what you paid on it into milestone 2, and so on. Each win makes the next one faster.</Text>
          <Text style={styles.hint}>Rates marked “assumed” use typical rates. Tap a milestone and enter the rate from your statement for an exact plan.</Text>
        </View>
      </Card>
    </Screen>
  );
}

const STOP_COLORS = ['#C2414F', '#C9671C', '#B9860F', '#2F6FC4', '#6E48C2'];

/** One stop on the journey: a coloured node on a vertical line, with its details beside it. */
function Milestone({ color, icon, title, sub, note, step, pct, first, last, onPress }: { color: string; icon: string; title: string; sub: string; note?: string; step?: number; pct?: number; first?: boolean; last?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 44, alignItems: 'center' }}>
        <View style={{ width: 3, height: 10, backgroundColor: first ? 'transparent' : colors.border }} />
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: color + '40' }}>
          {step ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{step}</Text> : <Icon name={icon} size={20} color="#fff" />}
        </View>
        <View style={{ width: 3, flex: 1, backgroundColor: last ? 'transparent' : colors.border, borderRadius: 2 }} />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: color, padding: 12, marginVertical: 6, gap: 4 }}>
        <Row style={{ gap: 6 }}>
          {step ? <Icon name={icon} size={15} color={color} /> : null}
          <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        </Row>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{sub}</Text>
        {pct !== undefined ? (
          <View style={{ gap: 3 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{pct}% of all debt cleared here</Text>
          </View>
        ) : null}
        {note ? <Text style={{ color: last ? colors.success : colors.text, fontSize: 12, fontWeight: '700' }}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

export default premiumOnly(Debts, 'Debt payoff planner', 'See which debt to clear first, how much extra to pay, and the date your family becomes debt-free.');
