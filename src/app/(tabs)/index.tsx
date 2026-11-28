import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { GradientBg, HeroCard } from '../../components/GradientBg';
import { AreaChart, BarChart, DonutChart, Gauge } from '../../components/charts';
import { ask } from '../../components/Dialog';
import { Card, Icon, Row, Screen, SectionTitle, styles } from '../../components/ui';
import { t } from '../../i18n';
import { expenses, inMonth, incomes, monthlyTotals, spendByCategory, sum } from '../../logic/analytics';
import { computeBalances, computeNetWorth } from '../../logic/balances';
import { generateActions } from '../../logic/actions';
import { diffDays, formatShortDate, monthLabel, shiftMonthKey, toISODate } from '../../logic/dates';
import { personBalances } from '../../logic/money2';
import { netWorthHistory } from '../../logic/reports';
import { savingsThisYear } from '../../logic/savings';
import { useAppData, useBalances, useCycle, useMoney } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme';

/** % change from `prev` to `cur`, or null when there is nothing to compare with. */
// Accents used on the gradient cards, matching the net worth card.
const TILE_ACCENT = ['#7EE3B5', '#FF9E8A', '#9CC3FF', '#FFD978', '#C9A7FF', '#FFB86B'];
// Each Home tile has its own gradient (dark → lighter), styled like the net worth card.
const TILE_GRADIENT = [
  ['#0B5D3B', '#14915F'], // Income – green
  ['#7A1F33', '#C2414F'], // Expenses – red
  ['#123C7A', '#2F6FC4'], // Money left – blue
  ['#6B4A07', '#B9860F'], // Investments – gold
  ['#3B2275', '#6E48C2'], // Cash & bank – purple
  ['#7A3A0C', '#C9671C'], // Debt – orange
];

const change = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10 : null);

export default function Home() {
  const data = useAppData();
  const updateSettings = useStore((s) => s.updateSettings);
  const balances = useBalances();
  const { money, compact } = useMoney();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 760) - 64;
  const on = new Date();
  const { key, startDay, label: cycleText, progress } = useCycle();
  const [chart, setChart] = useState<'flow' | 'spend'>('flow');

  const view = useMemo(() => {
    const month = inMonth(data.transactions, key, startDay);
    const last = inMonth(data.transactions, shiftMonthKey(key, -1), startDay);
    const spent = sum(expenses(month));
    const earned = sum(incomes(month));
    const spentLast = sum(expenses(last));
    const earnedLast = sum(incomes(last));
    const budgetTotal = data.budgets.reduce((s, b) => s + b.monthlyLimit, 0);
    const budgeted = new Set(data.budgets.map((b) => b.categoryId));
    const budgetSpent = sum(expenses(month).filter((t) => budgeted.has(t.categoryId ?? '')));
    const people = personBalances(data.transactions);
    const net = computeNetWorth(data.accounts, balances, people);
    // Debt a month ago, for the change shown on the Debt tile
    const monthAgo = toISODate(new Date(on.getFullYear(), on.getMonth() - 1, on.getDate()));
    const oldTxns = data.transactions.filter((t) => t.date <= monthAgo);
    const debtLast = computeNetWorth(data.accounts, computeBalances(data.accounts, oldTxns), personBalances(oldTxns)).liabilities;
    const history = netWorthHistory(data.accounts, data.transactions, on, 6);
    const prevNet = history.length > 1 ? history[history.length - 2].net : 0;
    return {
      spent,
      earned,
      savings: earned - spent,
      changes: { income: change(earned, earnedLast), spent: change(spent, spentLast), savings: change(earned - spent, earnedLast - spentLast), debt: change(net.liabilities, debtLast) },
      budgetTotal,
      budgetSpent,
      net,
      netChange: change(net.net, prevNet),
      history,
      months: monthlyTotals(data.transactions, key, 6, startDay),
      byCat: spendByCategory(month, data.categories),
      upcoming: generateActions(data, on).filter((a) => a.status !== 'done' && a.amount).sort((a, b) => a.date.getTime() - b.date.getTime()),
      saved: savingsThisYear(data, on),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, balances, key, startDay]);

  const tiles: { label: string; value: number; pct: number | null; icon: string; bg: string; fg: string; good: 'up' | 'down'; href: Href; trend: number[] }[] = [
    { label: t('Income'), value: view.earned, pct: view.changes.income, icon: 'wallet-outline', bg: colors.successSoft, fg: colors.success, good: 'up', href: '/transactions?type=income', trend: view.months.map((m) => m.income) },
    { label: t('Expenses'), value: view.spent, pct: view.changes.spent, icon: 'cart-outline', bg: colors.dangerSoft, fg: colors.danger, good: 'down', href: '/transactions?type=expense', trend: view.months.map((m) => m.expense) },
    { label: 'Money left', value: view.savings, pct: view.changes.savings, icon: 'leaf-outline', bg: colors.infoSoft, fg: colors.info, good: 'up', href: '/transactions?type=all', trend: view.months.map((m) => m.income - m.expense) },
    { label: 'Investments', value: view.net.byGroup.investment, pct: change(view.net.byGroup.investment, view.history.at(-2)?.investments ?? 0), icon: 'trending-up-outline', bg: colors.primarySoft, fg: colors.primary, good: 'up', href: data.settings.premium ? '/investments' : '/accounts?only=investment', trend: view.history.map((h) => h.investments) },
    { label: 'Cash & bank', value: view.net.liquid, pct: change(view.net.liquid, view.history.at(-2)?.liquid ?? 0), icon: 'cash-outline', bg: '#7C5CDB1f', fg: '#7C5CDB', good: 'up', href: '/accounts?only=cash', trend: view.history.map((h) => h.liquid) },
    { label: 'Debt', value: view.net.liabilities, pct: view.changes.debt, icon: 'trending-down-outline', bg: colors.warningSoft, fg: colors.warning, good: 'down', href: data.settings.premium ? '/debts' : '/accounts?only=debt', trend: view.history.map((h) => h.liabilities) },
  ];
  const tileChartW = Math.floor((Math.min(width, 760) - 42) / 2) - 24;
  const budgetPct = view.budgetTotal ? Math.round((view.budgetSpent / view.budgetTotal) * 100) : 0;
  const hour = on.getHours();
  const me = data.members.find((m) => m.id === data.settings.currentMemberId)?.name;
  const greeting = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}${me && me !== 'Me' ? `, ${me}` : ''} 👋`;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{greeting}</Text>
          <Text style={styles.hint}>Here’s your family’s money today.</Text>
        </View>

        {/* Net worth and how it grew */}
        <Pressable onPress={() => router.push('/accounts')} accessibilityRole="button" accessibilityLabel="Net worth. Open all account balances">
          <Card style={{ backgroundColor: '#1B1F5E', gap: 4, overflow: 'hidden', borderWidth: 0 }}>
            {/* indigo → emerald background */}
            <GradientBg id="nwbg" />
            {/* soft circles for depth */}
            <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#ffffff12', top: -90, right: -70 }} />
            <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#ffffff0d', bottom: -60, left: -40 }} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: '#ffffffcc', fontSize: 13 }}>{t('Net worth')}</Text>
              <Pressable
                onPress={() => updateSettings({ hideAmounts: !data.settings.hideAmounts })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={data.settings.hideAmounts ? 'Show amounts' : 'Hide amounts'}
              >
                <Icon name={data.settings.hideAmounts ? 'eye-off-outline' : 'eye-outline'} color="#fff" />
              </Pressable>
            </Row>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{money(view.net.net)}</Text>
            {view.netChange !== null ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: '#F5B84133', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: '#FFD978', fontWeight: '700', fontSize: 12 }}>
                  {view.netChange >= 0 ? '↑' : '↓'} {Math.abs(view.netChange)}% vs last month
                </Text>
              </View>
            ) : null}
            <View>
              <AreaChart values={view.history.map((h) => h.net)} labels={view.history.map((h) => h.label.slice(0, 3))} width={chartW} height={100} light lineColor="#FFD978" />
            </View>
            {/* What we own vs what we owe */}
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#ffffff33', marginTop: 4 }}>
              <View style={{ flex: Math.max(view.net.assets, 1), backgroundColor: '#7EE3B5' }} />
              <View style={{ flex: view.net.liabilities, backgroundColor: '#FF9E8A' }} />
            </View>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: '#ffffffdd', fontSize: 12 }}><Text style={{ color: '#7EE3B5' }}>●</Text> Own {compact(view.net.assets)}   <Text style={{ color: '#FF9E8A' }}>●</Text> Owe {compact(view.net.liabilities)}</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>All balances ›</Text>
            </Row>
          </Card>
        </Pressable>

        {view.saved.total > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              ask(
                `FamilyFin saved your family ${money(view.saved.total)} this year`,
                `• Card rewards & cashback: ${money(view.saved.rewards)}\n• Interest kept by paying with cards on interest-free days: ${money(view.saved.cardFloat)}\n• Left unspent in your budgets: ${money(view.saved.underBudget)}\n\nWorked out from your own entries since 1 January.`,
              )
            }
            style={{ backgroundColor: colors.successSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13 }}>💰 FamilyFin saved you {money(view.saved.total)} this year ›</Text>
          </Pressable>
        ) : null}

        {/* This cycle at a glance */}
        <SectionTitle title={`${cycleText} · ${progress.left} days left`} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {tiles.map((x, i) => {
            const good = x.pct === null ? null : x.good === 'up' ? x.pct >= 0 : x.pct <= 0;
            const accent = TILE_ACCENT[i];
            return (
              <Pressable key={x.label} onPress={() => router.push(x.href)} accessibilityRole="button" style={{ flexBasis: '47%', flexGrow: 1, borderRadius: 16, overflow: 'hidden' }}>
                <GradientBg id={`tile${i}`} colors={TILE_GRADIENT[i]} />
                <View pointerEvents="none" style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#ffffff10', top: -35, right: -30 }} />
                <View style={{ padding: 12, gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ backgroundColor: '#ffffff26', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={x.icon} color={accent} size={18} />
                    </View>
                    {x.pct !== null ? (
                      <View style={{ backgroundColor: '#ffffff1f', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: good ? '#7EE3B5' : '#FF9E8A' }}>
                          {x.pct >= 0 ? '↑' : '↓'} {Math.abs(x.pct)}%
                        </Text>
                      </View>
                    ) : null}
                  </Row>
                  <Text style={{ color: '#ffffffb3', fontSize: 12, marginTop: 4 }}>{x.label}</Text>
                  <Text style={{ fontSize: 19, fontWeight: '900', color: '#fff' }}>{compact(x.value)}</Text>
                  <View>
                    <AreaChart values={x.trend} width={tileChartW} height={34} light lineColor={accent} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {view.budgetTotal > 0 ? (
          <Pressable onPress={() => router.push('/budgets')} accessibilityRole="button">
            <HeroCard id="budgetbg">
              <Row style={{ gap: 16 }}>
                <Gauge value={view.budgetSpent / view.budgetTotal} label={`${budgetPct}%`} sub="used" light />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>This cycle’s budget</Text>
                  <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Spent {money(view.budgetSpent)} of {money(view.budgetTotal)}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: budgetPct > 100 ? '#FF9E8A' : '#7EE3B5' }}>
                    {budgetPct > 100 ? `${money(view.budgetSpent - view.budgetTotal)} over budget` : `${money(view.budgetTotal - view.budgetSpent)} left · ${progress.left} days`}
                  </Text>
                </View>
              </Row>
            </HeroCard>
          </Pressable>
        ) : null}

        {view.upcoming.length ? (
          <HeroCard id="upbg" style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Upcoming payments ({view.upcoming.length})</Text>
              <Text style={{ color: '#FFD978', fontWeight: '800' }} onPress={() => router.push('/actions')}>
                View all ›
              </Text>
            </Row>
            {view.upcoming.slice(0, 3).map((a) => {
              const d = diffDays(a.date, on);
              const tone = d < 0 ? '#FF9E8A' : d <= 3 ? '#FFD978' : '#9CC3FF';
              return (
                <Pressable key={a.id} onPress={() => router.push('/actions')} accessibilityRole="button">
                  <Row style={{ paddingVertical: 6 }}>
                    <View style={{ backgroundColor: '#ffffff1f', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={a.icon} color={tone} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{a.title}</Text>
                      <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{formatShortDate(a.date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{money(a.amount ?? 0)}</Text>
                      <View style={{ backgroundColor: tone + '33', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: tone }}>{d < 0 ? `${-d} days late` : d === 0 ? 'Today' : `in ${d} days`}</Text>
                      </View>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </HeroCard>
        ) : null}

        <HeroCard id="chartbg" style={{ gap: 10 }}>
          <Row>
            {(
              [
                ['flow', 'Income vs expenses'],
                ['spend', 'Spending'],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                onPress={() => setChart(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: chart === k }}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: chart === k ? '#fff' : '#ffffff1f' }}
              >
                <Text style={{ fontWeight: '800', fontSize: 13, color: chart === k ? '#1B1F5E' : '#fff' }}>{label}</Text>
              </Pressable>
            ))}
          </Row>
          {chart === 'flow' ? (
            <BarChart
              labels={view.months.map((m) => monthLabel(m.key).slice(0, 3))}
              series={[
                { name: t('Income'), color: '#7EE3B5', values: view.months.map((m) => m.income) },
                { name: t('Expenses'), color: '#FF9E8A', values: view.months.map((m) => m.expense) },
                { name: 'Money left', color: '#9CC3FF', values: view.months.map((m) => Math.max(0, m.income - m.expense)) },
              ]}
              width={chartW}
              height={160}
              format={compact}
              light
            />
          ) : view.byCat.length ? (
            <DonutChart data={view.byCat.map((c, i) => ({ ...c, color: TILE_ACCENT[i] ?? '#B0BEC5' }))} centerLabel="Spent" centerValue={compact(view.spent)} format={money} maxSlices={5} light />
          ) : (
            <Text style={{ color: '#ffffffb3', fontSize: 13 }}>No spending yet this cycle.</Text>
          )}
        </HeroCard>
      </Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={() => router.push('/add')}
        style={{ position: 'absolute', right: 20, bottom: 24, backgroundColor: colors.primary, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
      >
        <Icon name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}
