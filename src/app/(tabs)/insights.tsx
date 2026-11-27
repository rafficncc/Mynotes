import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { AreaChart, BarChart, CompareLines, HBars, ScoreRing } from '../../components/charts';
import { Button, Card, Chip, ChipRow, Icon, InsightCard, ProgressBar, Row, Screen, SectionTitle, styles } from '../../components/ui';
import {
  categoryChanges,
  cumulativeDaily,
  inMonth,
  incomes,
  monthlyTotals,
  needsWantsSavings,
  savingsRates,
  spendByMember,
  spendByMerchant,
  spendByPaymentMode,
  spendByWeekday,
  sum,
} from '../../logic/analytics';
import { cycleBounds, diffDays, monthLabel, shiftMonthKey } from '../../logic/dates';
import { generateInsights, healthScore, totalPotentialSaving } from '../../logic/insights';
import { useAppData, useCycle, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

type Range = 'month' | 'last' | '3m';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Insights() {
  const data = useAppData();
  const { money, compact } = useMoney();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 760) - 64;
  const [range, setRange] = useState<Range>('month');
  const [allTips, setAllTips] = useState(false);
  const on = new Date();
  const { key, startDay, progress } = useCycle();

  const v = useMemo(() => {
    const keys = range === 'month' ? [key] : range === 'last' ? [shiftMonthKey(key, -1)] : [0, 1, 2].map((i) => shiftMonthKey(key, -i));
    const txns = keys.flatMap((k) => inMonth(data.transactions, k, startDay));
    const cur = inMonth(data.transactions, key, startDay);
    const prevKey = shiftMonthKey(key, -1);
    const prev = inMonth(data.transactions, prevKey, startDay);
    const curB = cycleBounds(key, startDay);
    const prevB = cycleBounds(prevKey, startDay);
    const elapsed = Math.min(diffDays(on, curB.start) + 1, diffDays(curB.end, curB.start) + 1);
    const pace = { current: cumulativeDaily(cur, curB.start, elapsed), previous: cumulativeDaily(prev, prevB.start, diffDays(prevB.end, prevB.start) + 1) };
    const months = monthlyTotals(data.transactions, key, 6, startDay);
    // Budget-exceeded alerts live on the Budgets screen; Insights keeps saving ideas only.
    const insights = generateInsights(data, on).filter((i) => !i.id.startsWith('budget-over-'));
    return {
      pace,
      changes: categoryChanges(cur, prev, data.categories),
      months,
      rates: savingsRates(months),
      weekday: spendByWeekday(txns),
      byMode: spendByPaymentMode(txns, data.accounts),
      merchants: spendByMerchant(txns, 5),
      members: spendByMember(txns, data.members),
      nws: needsWantsSavings(txns, data.categories),
      income: sum(incomes(txns)),
      insights,
      potential: totalPotentialSaving(insights),
      health: healthScore(data, on),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range, key, startDay]);

  const day = v.pace.current.length;
  const nowSpent = v.pace.current[day - 1] ?? 0;
  const thenSpent = v.pace.previous[Math.min(day, v.pace.previous.length) - 1] ?? 0;
  const paceDiff = nowSpent - thenSpent;
  const ratesWithIncome = v.rates.filter((_, i) => v.months[i].income > 0);
  const avgRate = ratesWithIncome.length ? Math.round(ratesWithIncome.reduce((s, r) => s + r, 0) / ratesWithIncome.length) : null;
  const topDay = v.weekday.indexOf(Math.max(...v.weekday));
  const tips = allTips ? v.insights : v.insights.slice(0, 3);

  return (
    <Screen>
      {/* Money health */}
      <Card>
        <Row style={{ gap: 16 }}>
          <ScoreRing score={v.health.score} label={v.health.label} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.itemTitle}>Family money health</Text>
            {v.health.parts.map((p) => {
              const ok = p.score / p.max >= 0.6;
              return (
                <Row key={p.name} style={{ gap: 6 }}>
                  <Icon name={ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={ok ? colors.success : colors.warning} />
                  <Text style={[styles.itemSub, { flex: 1 }]}>{p.name}</Text>
                  <Text style={[styles.itemSub, { fontWeight: '700' }]}>
                    {p.score}/{p.max}
                  </Text>
                </Row>
              );
            })}
          </View>
        </Row>
      </Card>

      {/* Suggestions */}
      {v.potential > 0 ? (
        <Card style={{ backgroundColor: colors.successSoft, gap: 6 }}>
          <Text style={[styles.itemTitle, { color: colors.success }]}>You could save {money(v.potential)} a month</Text>
          <Text style={styles.insightText}>That’s {money(v.potential * 12)} a year if you follow these suggestions.</Text>
          <Button title="Try the cut-back simulator" variant="secondary" icon="options-outline" onPress={() => router.push('/simulator')} />
        </Card>
      ) : null}
      {tips.map((i) => (
        <InsightCard key={i.id} insight={i} money={money} />
      ))}
      {v.insights.length > 3 ? (
        <Pressable onPress={() => setAllTips((x) => !x)} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }}>{allTips ? 'Show fewer' : `Show all ${v.insights.length} suggestions`}</Text>
        </Pressable>
      ) : null}

      {/* Pace: are we spending faster than last cycle? */}
      <SectionTitle title="Spending pace" />
      <Card style={{ gap: 6 }}>
        <Text style={[styles.itemTitle, { color: paceDiff > 0 ? colors.danger : colors.success }]}>
          {thenSpent === 0 && nowSpent === 0
            ? 'No spending yet this cycle'
            : paceDiff > 0
              ? `${money(paceDiff)} more than last cycle by day ${day}`
              : `${money(-paceDiff)} less than last cycle by day ${day}`}
        </Text>
        <Text style={styles.hint}>
          Spent {money(nowSpent)} so far · {progress.left} days left
        </Text>
        <CompareLines current={v.pace.current} previous={v.pace.previous} width={chartW} format={compact} labels={['This cycle', 'Last cycle']} />
      </Card>

      {/* What changed */}
      {v.changes.length ? (
        <>
          <SectionTitle title="What changed vs last cycle" />
          <Card style={{ gap: 8 }}>
            {v.changes.map((c) => {
              const max = Math.max(...v.changes.map((x) => Math.abs(x.diff)));
              const up = c.diff > 0;
              return (
                <View key={c.key} style={{ gap: 3 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={styles.insightText}>{c.label}</Text>
                    <Text style={[styles.insightText, { fontWeight: '700', color: up ? colors.danger : colors.success }]}>
                      {up ? '↑ +' : '↓ −'}
                      {money(Math.abs(c.diff))}
                    </Text>
                  </Row>
                  <ProgressBar value={Math.abs(c.diff) / max} color={up ? colors.danger : colors.success} plain />
                  <Text style={styles.hint}>
                    {money(c.before)} → {money(c.now)}
                  </Text>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {/* Savings rate trend */}
      <SectionTitle title="Savings rate · 6 months" />
      <Card style={{ gap: 6 }}>
        <Text style={styles.itemTitle}>
          {avgRate === null ? 'Add income to see your savings rate' : `You keep ${avgRate}% of income on average`}
        </Text>
        <Text style={styles.hint}>A healthy target is 20% or more.</Text>
        <AreaChart values={v.rates} labels={v.months.map((m) => `${monthLabel(m.key).slice(0, 3)} ${v.rates[v.months.indexOf(m)]}%`)} width={chartW} height={110} color={colors.success} />
      </Card>

      {/* Spending patterns, for the chosen period */}
      <SectionTitle title="Spending patterns" />
      <ChipRow>
        <Chip label="This cycle" selected={range === 'month'} onPress={() => setRange('month')} />
        <Chip label="Last cycle" selected={range === 'last'} onPress={() => setRange('last')} />
        <Chip label="Last 3 cycles" selected={range === '3m'} onPress={() => setRange('3m')} />
      </ChipRow>

      <Card style={{ gap: 6 }}>
        <Text style={styles.itemTitle}>Needs · Wants · Savings (50-30-20)</Text>
        {(
          [
            ['Needs', v.nws.needs, 0.5, colors.info],
            ['Wants', v.nws.wants, 0.3, colors.accent],
            ['Savings & investments', v.nws.savings, 0.2, colors.success],
          ] as const
        ).map(([label, value, target, color]) => (
          <View key={label} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.insightText}>{label}</Text>
              <Text style={styles.insightText}>
                {v.income > 0 ? `${Math.round((value / v.income) * 100)}% · ideal ${target * 100}%` : money(value)}
              </Text>
            </Row>
            <ProgressBar value={v.income > 0 ? value / v.income : 0} color={color} plain />
          </View>
        ))}
        {v.income === 0 ? <Text style={styles.hint}>Add your income to compare against the 50-30-20 rule.</Text> : null}
      </Card>

      {v.weekday.some((x) => x > 0) ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.itemTitle}>Spending by day of the week</Text>
          <Text style={styles.hint}>Most spent on {WEEKDAY_NAMES[topDay]}s.</Text>
          <BarChart labels={WEEKDAYS} series={[{ name: 'Spent', color: colors.accent, values: v.weekday }]} width={chartW} height={150} format={compact} />
        </Card>
      ) : null}

      {v.byMode.length ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.itemTitle}>How you pay</Text>
          <HBars rows={v.byMode.map((m) => ({ label: m.label, value: m.value, color: m.color }))} format={money} />
        </Card>
      ) : null}

      {v.merchants.length ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.itemTitle}>Top shops</Text>
          <HBars rows={v.merchants.map((m) => ({ label: m.merchant, value: m.total, sub: `${m.count} visit${m.count === 1 ? '' : 's'}` }))} format={money} />
        </Card>
      ) : null}

      {v.members.length > 1 || (v.members[0] && v.members[0].id !== '_family') ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.itemTitle}>By family member</Text>
          <HBars rows={v.members.map((m) => ({ label: m.name, value: m.total, color: colors.info }))} format={money} />
        </Card>
      ) : null}
    </Screen>
  );
}
