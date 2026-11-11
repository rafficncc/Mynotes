import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { BarChart, DonutChart, HBars } from '../../components/charts';
import { Button, Card, Chip, ChipRow, InsightCard, ProgressBar, Row, Screen, SectionTitle, styles } from '../../components/ui';
import {
  inMonth,
  monthlyTotals,
  needsWantsSavings,
  incomes,
  spendByCategory,
  spendByMember,
  spendByMerchant,
  spendByPaymentMode,
  sum,
} from '../../logic/analytics';
import { monthLabel, shiftMonthKey, toISODate } from '../../logic/dates';
import { generateInsights, healthScore, totalPotentialSaving } from '../../logic/insights';
import { useAppData, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

type Range = 'month' | 'last' | '3m';

export default function Insights() {
  const data = useAppData();
  const { money, compact } = useMoney();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<Range>('month');
  const on = new Date();
  const key = toISODate(on).slice(0, 7);

  const v = useMemo(() => {
    const keys = range === 'month' ? [key] : range === 'last' ? [shiftMonthKey(key, -1)] : [0, 1, 2].map((i) => shiftMonthKey(key, -i));
    const txns = keys.flatMap((k) => inMonth(data.transactions, k));
    const insights = generateInsights(data, on);
    return {
      txns,
      byCat: spendByCategory(txns, data.categories),
      byMode: spendByPaymentMode(txns, data.accounts),
      merchants: spendByMerchant(txns, 6),
      members: spendByMember(txns, data.members),
      trend: monthlyTotals(data.transactions, key, 6),
      nws: needsWantsSavings(txns, data.categories),
      income: sum(incomes(txns)),
      insights,
      potential: totalPotentialSaving(insights),
      health: healthScore(data, on),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range, key]);

  const total = v.byCat.reduce((s, x) => s + x.value, 0);

  return (
    <Screen>
      {v.potential > 0 ? (
        <Card style={{ backgroundColor: colors.successSoft }}>
          <Text style={[styles.itemTitle, { color: colors.success }]}>Save up to {money(v.potential)} / month</Text>
          <Text style={styles.insightText}>
            That is {money(v.potential * 12)} a year if you follow the suggestions below.
          </Text>
          <Button title="Try the cut-back simulator" variant="secondary" icon="options-outline" onPress={() => router.push('/simulator')} />
        </Card>
      ) : null}

      <SectionTitle title="Suggestions for you" />
      {v.insights.length === 0 ? (
        <Card><Text style={styles.itemSub}>No suggestions yet – keep logging expenses for a couple of weeks.</Text></Card>
      ) : (
        v.insights.map((i) => <InsightCard key={i.id} insight={i} money={money} />)
      )}

      <SectionTitle title="Where the money goes" />
      <ChipRow>
        <Chip label="This month" selected={range === 'month'} onPress={() => setRange('month')} />
        <Chip label="Last month" selected={range === 'last'} onPress={() => setRange('last')} />
        <Chip label="Last 3 months" selected={range === '3m'} onPress={() => setRange('3m')} />
      </ChipRow>
      <Card>
        <DonutChart data={v.byCat} centerLabel="Spent" centerValue={compact(total)} format={money} />
      </Card>

      <Card>
        <Text style={styles.itemTitle}>Needs · Wants · Savings (50-30-20 rule)</Text>
        {(
          [
            ['Needs', v.nws.needs, 0.5, colors.info],
            ['Wants', v.nws.wants, 0.3, colors.accent],
            ['Savings & investments', v.nws.savings, 0.2, colors.success],
          ] as const
        ).map(([label, value, target, color]) => (
          <View key={label} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.insightText}>{label}</Text>
              <Text style={styles.insightText}>
                {money(value)}
                {v.income > 0 ? ` · ${Math.round((value / v.income) * 100)}% (ideal ${target * 100}%)` : ''}
              </Text>
            </Row>
            <ProgressBar value={v.income > 0 ? value / v.income : 0} color={color} plain />
          </View>
        ))}
        {v.income === 0 ? <Text style={styles.hint}>Add your income to compare against the 50-30-20 rule.</Text> : null}
      </Card>

      <Card>
        <Text style={styles.itemTitle}>Income vs expense – last 6 months</Text>
        <BarChart
          width={width - 64}
          labels={v.trend.map((t) => monthLabel(t.key))}
          series={[
            { name: 'Income', color: colors.success, values: v.trend.map((t) => t.income) },
            { name: 'Expense', color: colors.danger, values: v.trend.map((t) => t.expense) },
          ]}
          format={compact}
        />
      </Card>

      <Card>
        <Text style={styles.itemTitle}>By payment mode</Text>
        <DonutChart data={v.byMode} centerLabel="Modes" centerValue={String(v.byMode.length)} format={money} />
      </Card>

      {v.merchants.length > 0 ? (
        <Card>
          <Text style={styles.itemTitle}>Top shops & merchants</Text>
          <HBars rows={v.merchants.map((m) => ({ label: m.merchant, value: m.total, sub: `${m.count} visits` }))} format={money} />
        </Card>
      ) : null}

      {v.members.length > 1 || (v.members[0] && v.members[0].id !== '_family') ? (
        <Card>
          <Text style={styles.itemTitle}>Spend by family member</Text>
          <HBars rows={v.members.map((m) => ({ label: m.name, value: m.total, color: colors.info }))} format={money} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.itemTitle}>Health score breakdown · {v.health.score}/100</Text>
        {v.health.parts.map((p) => (
          <View key={p.name} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.insightText}>{p.name}</Text>
              <Text style={styles.insightText}>{p.score}/{p.max}</Text>
            </Row>
            <ProgressBar value={p.score / p.max} />
            <Text style={styles.hint}>{p.hint}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
