import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { AreaChart, BarChart, CompareLines, HealthGauge } from '../../components/charts';
import { GradientBg } from '../../components/GradientBg';
import { t } from '../../i18n';
import { Button, Card, Chip, ChipRow, Icon, InsightCard, Row, Screen, SectionTitle, styles } from '../../components/ui';
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
      // Shops only: rent, EMIs and savings aren't places you choose to spend.
      merchants: spendByMerchant(
        txns.filter((t) => t.categoryId !== 'rent' && t.categoryId !== 'emi' && data.categories.find((c) => c.id === t.categoryId)?.kind !== 'saving'),
        5,
      ),
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
  const spentTotal = v.byMode.reduce((t2, m) => t2 + m.value, 0);

  return (
    <Screen>
      {/* Financial health, in the app's hero colours */}
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <GradientBg id="healthbg" />
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#ffffff12', top: -90, right: -70 }} />
        <View style={{ padding: 16, alignItems: 'center', gap: 12 }}>
          <Text style={{ alignSelf: 'flex-start', color: '#fff', fontSize: 18, fontWeight: '800' }}>{t('Financial health')}</Text>
          <HealthGauge score={v.health.score} label={v.health.label} size={Math.min(260, chartW)} light />
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 4 }}>
            {v.health.parts.map((p) => {
              const ok = p.score / p.max >= 0.6;
              return (
                <View key={p.name} style={{ gap: 4 }}>
                  <Row style={{ gap: 8 }}>
                    <Icon name={ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={ok ? '#7EE3B5' : '#FFD978'} />
                    <Text style={{ flex: 1, color: '#fff', fontSize: 14 }}>{p.name}</Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                      {p.score}/{p.max}
                    </Text>
                  </Row>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: '#ffffff26', overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round((p.score / p.max) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: ok ? '#7EE3B5' : '#FFD978' }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

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
      <Hero id="pacebg">
        <CardHead icon="speedometer-outline" title={thenSpent === 0 && nowSpent === 0 ? 'No spending yet this cycle' : paceDiff > 0 ? `${money(paceDiff)} more than last cycle` : `${money(-paceDiff)} less than last cycle`} note={`By day ${day} · spent ${money(nowSpent)} · ${progress.left} days left`} tone={paceDiff > 0 ? CORAL : MINT} />
        <CompareLines current={v.pace.current} previous={v.pace.previous} width={chartW - 4} format={compact} labels={['This cycle', 'Last cycle']} light />
      </Hero>

      {/* What changed */}
      {v.changes.length ? (
        <>
          <SectionTitle title="What changed vs last cycle" />
          <Hero id="changebg">
            {v.changes.map((c) => {
              const max = Math.max(...v.changes.map((x) => Math.abs(x.diff)));
              const up = c.diff > 0;
              return (
                <View key={c.key} style={{ gap: 5 }}>
                  <Row style={{ gap: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: (up ? CORAL : MINT) + '33' }}>
                      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={15} color={up ? CORAL : MINT} />
                    </View>
                    <Text style={{ flex: 1, color: WHITE, fontWeight: '700', fontSize: 14 }}>{c.label}</Text>
                    <Text style={{ fontWeight: '900', fontSize: 14, color: up ? CORAL : MINT }}>
                      {up ? '+' : '−'}
                      {money(Math.abs(c.diff))}
                    </Text>
                  </Row>
                  <Bar value={Math.abs(c.diff) / max} color={up ? CORAL : MINT} />
                  <Text style={{ color: DIM, fontSize: 12 }}>
                    {money(c.before)} → {money(c.now)}
                  </Text>
                </View>
              );
            })}
          </Hero>
        </>
      ) : null}

      {/* Savings rate trend */}
      <SectionTitle title="Savings rate · 6 months" />
      <Hero id="ratebg">
        <CardHead icon="leaf-outline" title={avgRate === null ? 'Add income to see your savings rate' : `You keep ${avgRate}% of income`} note="A healthy target is 20% or more" tone={avgRate !== null && avgRate >= 20 ? MINT : GOLD} />
        <AreaChart values={v.rates} labels={v.months.map((m) => `${monthLabel(m.key).slice(0, 3)} ${v.rates[v.months.indexOf(m)]}%`)} width={chartW - 4} height={110} light lineColor={MINT} />
      </Hero>

      {/* Spending patterns, for the chosen period */}
      <SectionTitle title="Spending patterns" />
      <ChipRow>
        <Chip label="This cycle" selected={range === 'month'} onPress={() => setRange('month')} />
        <Chip label="Last cycle" selected={range === 'last'} onPress={() => setRange('last')} />
        <Chip label="Last 3 cycles" selected={range === '3m'} onPress={() => setRange('3m')} />
      </ChipRow>

      <Hero id="nwsbg">
        <CardHead icon="pie-chart-outline" title="Needs · Wants · Savings" note="Compared with the 50-30-20 rule" tone={BLUE} />
        {(
          [
            ['Needs', v.nws.needs, 0.5, BLUE],
            ['Wants', v.nws.wants, 0.3, GOLD],
            ['Savings & investments', v.nws.savings, 0.2, MINT],
          ] as const
        ).map(([label, value, target, color]) => (
          <View key={label} style={{ gap: 5 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: WHITE, fontWeight: '700', fontSize: 14 }}>{label}</Text>
              <Text style={{ color: DIM, fontSize: 12 }}>
                {v.income > 0 ? (
                  <>
                    <Text style={{ color, fontWeight: '900', fontSize: 14 }}>{Math.round((value / v.income) * 100)}%</Text> · ideal {target * 100}%
                  </>
                ) : (
                  money(value)
                )}
              </Text>
            </Row>
            <Bar value={v.income > 0 ? value / v.income : 0} color={color} mark={target} />
          </View>
        ))}
        {v.income === 0 ? <Text style={{ color: DIM, fontSize: 12 }}>Add your income to compare against the 50-30-20 rule.</Text> : null}
      </Hero>

      {v.weekday.some((x) => x > 0) ? (
        <Hero id="weekbg">
          <CardHead icon="calendar-outline" title="Spending by day of the week" note={`Most spent on ${WEEKDAY_NAMES[topDay]}s`} tone={GOLD} />
          <BarChart labels={WEEKDAYS} series={[{ name: 'Spent', color: GOLD, values: v.weekday }]} width={chartW - 4} height={150} format={compact} light />
        </Hero>
      ) : null}

      {v.byMode.length ? (
        <Hero id="paybg">
          <CardHead icon="card-outline" title="How you pay" note={`Most by ${v.byMode[0].label} · ${pct(v.byMode[0].value, spentTotal)}%`} tone={BLUE} />
          <Breakdown
            rows={v.byMode.map((m) => ({ key: m.key, label: m.label, value: m.value, color: MODE_COLOR[m.key] ?? GOLD, icon: MODE_ICON[m.key] ?? 'ellipsis-horizontal' }))}
            money={money}
          />
          {pct(v.byMode.find((m) => m.key === 'credit_card')?.value ?? 0, spentTotal) >= 40 ? (
            <Text style={{ color: GOLD, fontSize: 12 }}>💡 Over 40% goes on credit cards. Pay the full bill each month to avoid interest.</Text>
          ) : null}
        </Hero>
      ) : null}

      {v.merchants.length ? (
        <Hero id="shopbg">
          <CardHead icon="storefront-outline" title="Top places you spend" note={`${v.merchants[0].merchant} leads with ${money(v.merchants[0].total)}`} tone={GOLD} />
          {v.merchants.map((m, i) => (
            <Row key={m.merchant} style={{ gap: 12 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: (MEDALS[i] ?? WHITE) + '33' }}>
                <Text style={{ color: MEDALS[i] ?? WHITE, fontWeight: '900', fontSize: 13 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row style={{ gap: 8 }}>
                  <Text style={{ flex: 1, color: WHITE, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                    {m.merchant}
                  </Text>
                  <Text style={{ color: WHITE, fontWeight: '800', fontSize: 14 }}>{money(m.total)}</Text>
                </Row>
                <Bar value={m.total / v.merchants[0].total} color={MEDALS[i] ?? BLUE} />
                <Text style={{ color: DIM, fontSize: 12 }}>
                  {m.count} visit{m.count === 1 ? '' : 's'}
                  {m.count > 1 ? ` · about ${money(Math.round(m.total / m.count))} each time` : ''}
                </Text>
              </View>
            </Row>
          ))}
        </Hero>
      ) : null}

      {v.members.length > 1 || (v.members[0] && v.members[0].id !== '_family') ? (
        <Hero id="whobg">
          <CardHead icon="people-outline" title="Who spends" note={`Shared and personal spending · ${money(spentTotal)}`} tone={MINT} />
          <Breakdown rows={v.members.map((m, i) => ({ key: m.id, label: m.name, value: m.total, color: PEOPLE_COLORS[i % PEOPLE_COLORS.length], initial: m.id === '_family' ? '👪' : m.name.slice(0, 1).toUpperCase() }))} money={money} />
        </Hero>
      ) : null}
    </Screen>
  );
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
// Same look as the Financial health card: hero gradient, white text, bright accents.
const WHITE = '#fff';
const DIM = '#ffffffb3';
const TRACK = '#ffffff26';
const GOLD = '#FFD978';
const MINT = '#7EE3B5';
const CORAL = '#FF9E8A';
const BLUE = '#9CC3FF';
const MODE_ICON: Record<string, string> = { bank: 'business-outline', credit_card: 'card-outline', debit_card: 'card-outline', wallet: 'phone-portrait-outline', cash: 'cash-outline', people: 'people-outline' };
const MODE_COLOR: Record<string, string> = { bank: BLUE, credit_card: CORAL, debit_card: '#7FDBEA', wallet: '#C9A7FF', cash: MINT };
const MEDALS = [GOLD, '#D5DCE4', '#E9A36A'];
const PEOPLE_COLORS = [BLUE, CORAL, MINT, GOLD, '#C9A7FF', '#7FDBEA'];

function Hero({ id, children }: { id: string; children: ReactNode }) {
  return (
    <View style={{ borderRadius: 20, overflow: 'hidden' }}>
      <GradientBg id={id} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff10', top: -70, right: -60 }} />
      <View style={{ padding: 16, gap: 12 }}>{children}</View>
    </View>
  );
}

function CardHead({ icon, title, note, tone }: { icon: string; title: string; note: string; tone: string }) {
  return (
    <Row style={{ gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: TRACK }}>
        <Icon name={icon} size={18} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: WHITE, fontSize: 16, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: DIM, fontSize: 12 }} numberOfLines={1}>
          {note}
        </Text>
      </View>
    </Row>
  );
}

/** Thin bar on a white track; `mark` draws a target line (e.g. the 50-30-20 ideal). */
function Bar({ value, color, mark }: { value: number; color: string; mark?: number }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: TRACK }}>
      <View style={{ width: `${Math.min(100, Math.max(2, value * 100))}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
      {mark ? <View style={{ position: 'absolute', left: `${mark * 100}%`, top: -3, width: 2, height: 12, borderRadius: 1, backgroundColor: WHITE }} /> : null}
    </View>
  );
}

/** One stacked bar showing each share, then a row per item with its amount and percentage. */
function Breakdown({ rows, money }: { rows: { key: string; label: string; value: number; color: string; icon?: string; initial?: string }[]; money: (n: number) => string }) {
  const total = rows.reduce((t2, r) => t2 + r.value, 0);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
        {rows.map((r) => (
          <View key={r.key} style={{ flex: Math.max(r.value, total * 0.01), backgroundColor: r.color }} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        {rows.map((r) => (
          <Row key={r.key} style={{ gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: r.color + '33' }}>
              {r.icon ? <Icon name={r.icon} size={16} color={r.color} /> : <Text style={{ color: r.color, fontWeight: '900', fontSize: 14 }}>{r.initial}</Text>}
            </View>
            <Text style={{ flex: 1, color: WHITE, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: WHITE, fontWeight: '800', fontSize: 14 }}>{money(r.value)}</Text>
              <Text style={{ color: r.color, fontWeight: '700', fontSize: 11 }}>{pct(r.value, total)}%</Text>
            </View>
          </Row>
        ))}
      </View>
    </View>
  );
}
