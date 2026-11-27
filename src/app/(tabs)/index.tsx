import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { AreaChart, BarChart, DonutChart } from '../../components/charts';
import { ask } from '../../components/Dialog';
import { Card, Icon, ProgressBar, Row, Screen, SectionTitle, styles } from '../../components/ui';
import { t } from '../../i18n';
import { expenses, inMonth, incomes, monthlyTotals, spendByCategory, sum } from '../../logic/analytics';
import { computeBalances, computeNetWorth } from '../../logic/balances';
import { generateActions } from '../../logic/actions';
import { formatShortDate, monthLabel, shiftMonthKey, toISODate } from '../../logic/dates';
import { personBalances } from '../../logic/money2';
import { netWorthHistory } from '../../logic/reports';
import { savingsThisYear } from '../../logic/savings';
import { useAppData, useBalances, useCycle, useMoney } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme';

/** % change from `prev` to `cur`, or null when there is nothing to compare with. */
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

  const tiles: { label: string; value: number; pct: number | null; icon: string; bg: string; fg: string; good: 'up' | 'down'; href: Href }[] = [
    { label: t('Income'), value: view.earned, pct: view.changes.income, icon: 'wallet-outline', bg: colors.successSoft, fg: colors.success, good: 'up', href: '/transactions' },
    { label: t('Expenses'), value: view.spent, pct: view.changes.spent, icon: 'cart-outline', bg: colors.dangerSoft, fg: colors.danger, good: 'down', href: '/transactions' },
    { label: 'Savings', value: view.savings, pct: view.changes.savings, icon: 'leaf-outline', bg: colors.infoSoft, fg: colors.info, good: 'up', href: '/reports' },
    { label: 'Debt', value: view.net.liabilities, pct: view.changes.debt, icon: 'trending-down-outline', bg: colors.warningSoft, fg: colors.warning, good: 'down', href: '/debts' },
  ];
  const budgetPct = view.budgetTotal ? Math.round((view.budgetSpent / view.budgetTotal) * 100) : 0;

  return (
    <Screen>
      {/* Net worth and how it grew */}
      <Pressable onPress={() => router.push('/accounts')} accessibilityRole="button" accessibilityLabel="Net worth. Open all account balances">
        <Card style={{ backgroundColor: colors.primary, gap: 4 }}>
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
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff26', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                {view.netChange >= 0 ? '↑' : '↓'} {Math.abs(view.netChange)}% vs last month
              </Text>
            </View>
          ) : null}
          <AreaChart values={view.history.map((h) => h.net)} labels={view.history.map((h) => h.label.slice(0, 3))} width={chartW} height={96} light />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: '#ffffffcc', fontSize: 12 }}>Own {compact(view.net.assets)} · Owe {compact(view.net.liabilities)}</Text>
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

      {/* Quick add */}
      <Row style={{ justifyContent: 'space-between' }}>
        {(
          [
            ['remove-circle-outline', t('Expense'), '/add?type=expense'],
            ['add-circle-outline', t('Income'), '/add?type=income'],
            ['swap-horizontal', t('Transfer'), '/add?type=transfer'],
            ['scan-outline', 'Scan', '/scan'],
            ['mic-outline', 'Voice', '/voice'],
          ] as [string, string, Href][]
        ).map(([icon, label, href]) => (
          <Pressable key={label} onPress={() => router.push(href)} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            <View style={{ backgroundColor: colors.primarySoft, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 12, color: colors.text }}>{label}</Text>
          </Pressable>
        ))}
      </Row>

      {/* This cycle at a glance */}
      <SectionTitle title={`${cycleText} · ${progress.left} days left`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tiles.map((x) => {
          const good = x.pct === null ? null : x.good === 'up' ? x.pct >= 0 : x.pct <= 0;
          return (
            <Pressable key={x.label} onPress={() => router.push(x.href)} accessibilityRole="button" style={{ flexBasis: '47%', flexGrow: 1 }}>
              <View style={{ backgroundColor: x.bg, borderRadius: 16, padding: 14, gap: 2, alignItems: 'center' }}>
                <Icon name={x.icon} color={x.fg} />
                <Text style={styles.itemSub}>{x.label}</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{compact(x.value)}</Text>
                {x.pct !== null ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: good ? colors.success : colors.danger }}>
                    {x.pct >= 0 ? '↑' : '↓'} {Math.abs(x.pct)}%
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {view.budgetTotal > 0 ? (
        <Pressable onPress={() => router.push('/budgets')} accessibilityRole="button">
          <Card style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.itemTitle}>This cycle’s budget</Text>
              <Text style={[styles.itemSub, { color: budgetPct > 100 ? colors.danger : colors.text }]}>{budgetPct}% used</Text>
            </Row>
            <ProgressBar value={view.budgetSpent / view.budgetTotal} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.hint}>Spent {money(view.budgetSpent)}</Text>
              <Text style={styles.hint}>Budget {money(view.budgetTotal)}</Text>
            </Row>
          </Card>
        </Pressable>
      ) : null}

      {view.upcoming.length ? (
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.itemTitle}>Upcoming payments ({view.upcoming.length})</Text>
            <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => router.push('/actions')}>
              View all
            </Text>
          </Row>
          {view.upcoming.slice(0, 3).map((a) => (
            <Pressable key={a.id} onPress={() => router.push('/actions')} accessibilityRole="button">
              <Row style={{ paddingVertical: 6 }}>
                <Icon name={a.icon} color={a.status === 'overdue' ? colors.danger : colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={[styles.itemSub, a.status === 'overdue' && { color: colors.danger }]}>
                    {a.status === 'overdue' ? 'Overdue' : 'Due'} {formatShortDate(a.date)}
                  </Text>
                </View>
                <Text style={styles.itemTitle}>{money(a.amount ?? 0)}</Text>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
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
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: chart === k ? colors.primary : colors.bg }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: chart === k ? '#fff' : colors.text }}>{label}</Text>
            </Pressable>
          ))}
        </Row>
        {chart === 'flow' ? (
          <BarChart
            labels={view.months.map((m) => monthLabel(m.key).slice(0, 3))}
            series={[
              { name: t('Income'), color: colors.success, values: view.months.map((m) => m.income) },
              { name: t('Expenses'), color: colors.danger, values: view.months.map((m) => m.expense) },
              { name: 'Savings', color: colors.info, values: view.months.map((m) => Math.max(0, m.income - m.expense)) },
            ]}
            width={chartW}
            height={160}
            format={compact}
          />
        ) : view.byCat.length ? (
          <DonutChart data={view.byCat} centerLabel="Spent" centerValue={compact(view.spent)} format={money} maxSlices={5} />
        ) : (
          <Text style={styles.hint}>No spending yet this cycle.</Text>
        )}
      </Card>
    </Screen>
  );
}
