import { router } from 'expo-router';
import { t } from '../../i18n';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScoreRing } from '../../components/charts';
import { Button, Card, Icon, InsightCard, ListItem, ProgressBar, Row, Screen, SectionTitle, Stat, styles } from '../../components/ui';
import { expenses, inMonth, incomes, projectMonth, sum } from '../../logic/analytics';
import { computeNetWorth } from '../../logic/balances';
import { cardCycleInfo, isCreditCardConfigured, recommendCards } from '../../logic/creditCard';
import { formatDate, formatShortDate } from '../../logic/dates';
import { generateInsights, healthScore, noSplurgeStreak, totalPotentialSaving } from '../../logic/insights';
import { useStore } from '../../store/useStore';
import { useAppData, useBalances, useCycle, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

export default function Home() {
  const data = useAppData();
  const updateSettings = useStore((s) => s.updateSettings);
  const balances = useBalances();
  const { money, compact } = useMoney();
  const on = new Date();
  const { key, startDay, label: cycleText, progress } = useCycle();

  const view = useMemo(() => {
    const month = inMonth(data.transactions, key, startDay);
    const spent = sum(expenses(month));
    const earned = sum(incomes(month));
    const budgetTotal = data.budgets.reduce((s, b) => s + b.monthlyLimit, 0);
    const budgeted = new Set(data.budgets.map((b) => b.categoryId));
    const budgetSpent = sum(expenses(month).filter((t) => budgeted.has(t.categoryId ?? '')));
    const insights = generateInsights(data, on);
    const cards = data.accounts.filter((a) => isCreditCardConfigured(a) && !a.archived);
    return {
      spent,
      earned,
      projected: projectMonth(month, data.categories, on, startDay),
      budgetTotal,
      budgetSpent,
      net: computeNetWorth(data.accounts, balances),
      insights,
      potential: totalPotentialSaving(insights),
      health: healthScore(data, on),
      streak: noSplurgeStreak(data, on),
      bestCard: recommendCards(cards, balances, on)[0],
      dues: cards
        .map((c) => cardCycleInfo(c, data.transactions, balances[c.id] ?? 0, on, data.emis))
        .filter((i) => i.amountDue > 0)
        .sort((a, b) => a.daysToDue - b.daysToDue),
      recent: data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, balances, key, startDay]);

  const cat = (id?: string) => data.categories.find((c) => c.id === id);
  const acc = (id?: string) => data.accounts.find((a) => a.id === id);

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.primary }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: '#ffffffcc', fontSize: 13, flex: 1 }}>{t('Spent this cycle')} · {cycleText} · {progress.left} days left</Text>
          <Pressable
            onPress={() => updateSettings({ hideAmounts: !data.settings.hideAmounts })}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={data.settings.hideAmounts ? 'Show amounts' : 'Hide amounts'}
          >
            <Icon name={data.settings.hideAmounts ? 'eye-off-outline' : 'eye-outline'} color="#fff" />
          </Pressable>
        </Row>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{money(view.spent)}</Text>
        <Text style={{ color: '#ffffffcc', fontSize: 12 }}>
          Projected {money(view.projected)}
        </Text>
        {view.budgetTotal > 0 ? (
          <>
            <Text style={{ color: '#ffffffcc', fontSize: 12, marginTop: 6 }}>
              Budgeted categories: {money(view.budgetSpent)} of {money(view.budgetTotal)}
            </Text>
            <ProgressBar value={view.budgetSpent / view.budgetTotal} color="#fff" />
          </>
        ) : null}
        <Row style={{ marginTop: 8 }}>
          <Stat label={t('Income')} value={compact(view.earned)} color="#fff" labelColor="#ffffffcc" />
          <Stat label={t('Net worth')} value={compact(view.net.net)} color="#fff" labelColor="#ffffffcc" />
          <Stat label={t('Cash & bank')} value={compact(view.net.liquid)} color="#fff" labelColor="#ffffffcc" />
        </Row>
      </Card>

      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><Button title={t('Expense')} icon="remove-circle-outline" onPress={() => router.push('/add?type=expense')} /></View>
        <View style={{ flex: 1 }}><Button title={t('Income')} variant="secondary" icon="add-circle-outline" onPress={() => router.push('/add?type=income')} /></View>
        <View style={{ flex: 1 }}><Button title={t('Transfer')} variant="secondary" icon="swap-horizontal" onPress={() => router.push('/add?type=transfer')} /></View>
      </Row>
      <Button title={t('Scan a bill')} variant="secondary" icon="scan-outline" onPress={() => router.push('/scan')} />

      <Pressable onPress={() => router.push('/insights')}>
        <Card>
          <Row style={{ gap: 16 }}>
            <ScoreRing score={view.health.score} label={view.health.label} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.itemTitle}>{t('Family money health')}</Text>
              {view.health.parts.map((p) => (
                <Text key={p.name} style={styles.itemSub}>
                  {p.name}: {p.score}/{p.max}
                </Text>
              ))}
            </View>
          </Row>
          {view.potential > 0 ? (
            <Text style={{ color: colors.success, fontWeight: '700' }}>
              You could save about {money(view.potential)} every month. See how →
            </Text>
          ) : null}
        </Card>
      </Pressable>

      <Row style={{ gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Icon name="flame" color={colors.accent} size={22} />
          <Text style={styles.statValue}>{view.streak} day{view.streak === 1 ? '' : 's'}</Text>
          <Text style={styles.itemSub}>{t('No-splurge streak')}</Text>
        </Card>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/cards')}>
          <Card style={{ flex: 1 }}>
            <Icon name="card" color={colors.info} size={22} />
            <Text style={styles.statValue} numberOfLines={1}>{view.bestCard ? view.bestCard.account.name : 'Add a card'}</Text>
            <Text style={styles.itemSub}>
              {view.bestCard ? `Best card today · ${view.bestCard.freeDays} days free` : 'Get the best-card tip'}
            </Text>
          </Card>
        </Pressable>
      </Row>

      {view.dues.length > 0 ? (
        <>
          <SectionTitle title={t('Card bills due')} />
          <Card>
            {view.dues.map((d) => (
              <ListItem
                key={d.account.id}
                icon="card"
                iconColor={d.daysToDue < 0 ? colors.danger : colors.warning}
                title={d.account.name}
                subtitle={d.daysToDue < 0 ? `Overdue since ${formatShortDate(d.dueDate)}` : `Due ${formatShortDate(d.dueDate)} · ${d.daysToDue} days left`}
                right={money(d.amountDue)}
                rightColor={d.daysToDue < 3 ? colors.danger : undefined}
                onPress={() => router.push(`/add?type=transfer&to=${d.account.id}&amount=${Math.round(d.amountDue)}`)}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title={t('Top suggestions')} action="All insights" onAction={() => router.push('/insights')} />
      {view.insights.slice(0, 3).map((i) => <InsightCard key={i.id} insight={i} money={money} />)}
      {view.insights.length === 0 ? (
        <Card><Text style={styles.itemSub}>Add a few transactions and suggestions will appear here.</Text></Card>
      ) : null}

      <SectionTitle title={t('Recent')} action="See all" onAction={() => router.push('/transactions')} />
      <Card>
        {view.recent.length === 0 ? <Text style={styles.itemSub}>No transactions yet. Tap “Expense” to add your first one.</Text> : null}
        {view.recent.map((t) => {
          const c = cat(t.categoryId);
          const isTransfer = t.type === 'transfer';
          return (
            <ListItem
              key={t.id}
              icon={isTransfer ? 'swap-horizontal' : c?.icon ?? 'pricetag-outline'}
              iconColor={isTransfer ? colors.info : c?.color}
              title={isTransfer ? `${acc(t.accountId)?.name} → ${acc(t.toAccountId)?.name}` : t.merchant || c?.name || 'Transaction'}
              subtitle={`${formatDate(t.date)} · ${acc(t.accountId)?.name ?? ''}`}
              right={`${t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}${money(t.amount)}`}
              rightColor={t.type === 'income' ? colors.success : undefined}
              onPress={() => router.push(`/add?id=${t.id}`)}
            />
          );
        })}
      </Card>
    </Screen>
  );
}
