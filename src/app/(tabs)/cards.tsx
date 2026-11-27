import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { GradientBg } from '../../components/GradientBg';
import { BarChart, HBars } from '../../components/charts';
import { inMonth } from '../../logic/analytics';
import { TipCard } from '../../components/TipCard';
import { Button, Card, Chip, ChipRow, Empty, Field, Icon, ProgressBar, Row, Screen, SectionTitle, styles } from '../../components/ui';
import { cardCycleInfo, goldenWindow, isCreditCardConfigured, recommendCards } from '../../logic/creditCard';
import { addDays, formatShortDate, toISODate } from '../../logic/dates';
import { estimatedRewards } from '../../logic/trackers';
import { useAppData, useBalances, useCycle, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

/** Each card gets its own look, like a real card. */
const CARD_LOOKS: [string, string][] = [
  ['#1B1F5E', '#0B6E4F'],
  ['#5B247A', '#1BCEDF'],
  ['#3A1C71', '#D76D77'],
  ['#0F2027', '#2C5364'],
  ['#C33764', '#1D2671'],
  ['#134E5E', '#71B280'],
];

/** Small ring for use on a coloured card. */
function MiniRing({ value, size = 46 }: { value: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff40" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={v > 0.3 ? '#FFD978' : '#7EE3B5'} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

const WHEN = [
  { label: 'Today', days: 0 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 15 days', days: 15 },
];

export default function SmartCard() {
  const data = useAppData();
  const balances = useBalances();
  const { money, compact } = useMoney();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 760) - 64;
  const cycle = useCycle();
  const [amount, setAmount] = useState('');
  const [whenDays, setWhenDays] = useState(0);
  const on = new Date();

  const allCards = data.accounts.filter((a) => a.type === 'credit_card' && !a.archived);
  const cards = allCards.filter(isCreditCardConfigured);
  const missing = allCards.filter((a) => !isCreditCardConfigured(a));
  const purchaseDate = addDays(on, whenDays);
  const amt = parseFloat(amount) || 0;

  const recs = useMemo(() => recommendCards(cards, balances, purchaseDate, amt), [cards, balances, whenDays, amt]); // eslint-disable-line react-hooks/exhaustive-deps
  const infos = useMemo(
    () => cards.map((c) => cardCycleInfo(c, data.transactions, balances[c.id] ?? 0, on, data.emis)),
    [cards, data.transactions, balances], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Totals across all cards, and this cycle's spending on each card
  const totals = useMemo(() => {
    const outstanding = infos.reduce((s, i) => s + i.outstanding, 0);
    const due = infos.reduce((s, i) => s + i.amountDue, 0);
    const limit = infos.reduce((s, i) => s + (i.account.creditLimit ?? 0), 0);
    const available = infos.reduce((s, i) => s + (i.available ?? 0), 0);
    const cycleTxns = inMonth(data.transactions, cycle.key, cycle.startDay);
    const spend = allCards.map((c, idx) => ({ label: c.name, value: Math.round(cycleTxns.filter((t) => t.type === 'expense' && t.accountId === c.id).reduce((s2, t) => s2 + t.amount, 0)), color: CARD_LOOKS[idx % CARD_LOOKS.length][1] }));
    return { outstanding, due, limit, available, util: limit ? outstanding / limit : null, spend };
  }, [infos, data.transactions, cycle.key, cycle.startDay]); // eslint-disable-line react-hooks/exhaustive-deps

  if (allCards.length === 0) {
    return (
      <Screen>
        <Empty
          icon="card-outline"
          title="Add your credit cards"
          text="Enter each card's billing date and due date once. FamilyFin then tells you which card to swipe for the longest interest-free period – up to 50 days."
        />
        <Button title="Add a credit card" icon="add" onPress={() => router.push('/account-form?type=credit_card')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TipCard
        id="cards"
        title="How Smart Card works"
        points={[
          'Each card has a billing day (statement) and a due day. Spends right after the billing day get the longest time to pay – up to 50 days.',
          'Enter an amount and when you plan to buy; the card at the top gives the most interest-free days with enough limit.',
          'When you add an expense, FamilyFin also tells you if another card would be better.',
          'Always pay the full bill by the due date to keep it interest-free.',
        ]}
      />
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <GradientBg id="cardsum" />
        <Row style={{ padding: 16, gap: 16 }}>
          {totals.util !== null ? <MiniRing value={totals.util} size={84} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: '#ffffffaa', fontSize: 12 }}>Total on {allCards.length} card{allCards.length === 1 ? '' : 's'}</Text>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{money(totals.outstanding)}</Text>
            <Text style={{ color: '#FFD978', fontSize: 13, fontWeight: '700' }}>{totals.due > 0 ? `${money(totals.due)} due soon` : 'No bills due'}</Text>
            {totals.limit ? <Text style={{ color: '#ffffffcc', fontSize: 12 }}>{compact(totals.available)} available of {compact(totals.limit)} · keep use under 30%</Text> : null}
          </View>
        </Row>
      </View>

      <Card>
        <Text style={styles.itemTitle}>Which card should I use?</Text>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Purchase amount (optional)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 25000" />
          </View>
        </Row>
        <ChipRow>
          {WHEN.map((w) => (
            <Chip key={w.label} label={w.label} selected={whenDays === w.days} onPress={() => setWhenDays(w.days)} />
          ))}
        </ChipRow>
        {recs.length === 0 ? (
          <Text style={[styles.insightText, { color: colors.danger }]}>No card has enough available limit for this amount.</Text>
        ) : (
          recs.map((r, i) => (
            <View
              key={r.account.id}
              style={{ padding: 12, borderRadius: 12, backgroundColor: i === 0 ? colors.successSoft : colors.bg, gap: 2 }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Row>
                  {i === 0 ? <Icon name="trophy" color={colors.success} size={18} /> : null}
                  <Text style={styles.itemTitle}>{r.account.name}</Text>
                </Row>
                <Text style={[styles.itemTitle, { color: i === 0 ? colors.success : colors.text }]}>{r.freeDays} days</Text>
              </Row>
              <Text style={styles.itemSub}>
                Bill on {formatShortDate(r.statementDate)} · pay by {formatShortDate(r.dueDate)}
                {r.available !== null ? ` · ${money(r.available)} available` : ''}
                {r.account.rewardRate ? ` · ${r.account.rewardRate}% rewards` : ''}
              </Text>
            </View>
          ))
        )}
        <Text style={styles.hint}>
          Tip: buy big items just after a card’s billing date – that’s when you get the longest time to pay. Always pay the full bill to keep it interest-free.
        </Text>
      </Card>

      {missing.length > 0 ? (
        <Card style={{ backgroundColor: colors.warningSoft }}>
          <Text style={[styles.itemTitle, { color: colors.warning }]}>Billing dates needed</Text>
          <Text style={styles.insightText}>Add the billing and due dates for: {missing.map((m) => m.name).join(', ')}.</Text>
          <ChipRow>
            {missing.map((m) => (
              <Chip key={m.id} label={`Set up ${m.name}`} onPress={() => router.push(`/account-form?id=${m.id}`)} />
            ))}
          </ChipRow>
        </Card>
      ) : null}

      <SectionTitle title="Your cards" action="Add card" onAction={() => router.push('/account-form?type=credit_card')} />
      {infos.map((info) => {
        const look = CARD_LOOKS[allCards.findIndex((c) => c.id === info.account.id) % CARD_LOOKS.length];
        const gw = goldenWindow(info.account, on);
        const earned = estimatedRewards(info.account, data.transactions, toISODate(info.lastStatement));
        const pointsWorth = (info.account.rewardPoints ?? 0) * (info.account.pointValue ?? 0);
        const overdue = info.amountDue > 0 && info.daysToDue < 0;
        return (
          <Card key={info.account.id}>
            {/* The card itself */}
            <Pressable onPress={() => router.push(`/account-form?id=${info.account.id}`)} accessibilityRole="button" accessibilityLabel={`Edit ${info.account.name}`} style={{ borderRadius: 18, overflow: 'hidden', aspectRatio: 1.75 }}>
              <GradientBg id={`cg${info.account.id}`} colors={look} />
              <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff14', top: -60, right: -50 }} />
              <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }} numberOfLines={1}>{info.account.name}</Text>
                  <Icon name="wifi" color="#ffffffcc" size={20} />
                </Row>
                <View style={{ width: 38, height: 28, borderRadius: 6, backgroundColor: '#FFD978cc' }} />
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View>
                    <Text style={{ color: '#ffffffaa', fontSize: 11 }}>{overdue ? 'Overdue' : 'Amount due'}</Text>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{money(info.amountDue)}</Text>
                    <Text style={{ color: overdue ? '#FF9E8A' : '#ffffffcc', fontSize: 11, fontWeight: '600' }}>
                      {info.amountDue > 0 ? (overdue ? `was due ${formatShortDate(info.dueDate)}` : `pay by ${formatShortDate(info.dueDate)}`) : 'All paid ✓'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    {info.utilization !== null ? <MiniRing value={info.utilization} /> : null}
                    <Text style={{ color: '#ffffffaa', fontSize: 10 }}>limit used</Text>
                  </View>
                </Row>
              </View>
            </Pressable>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.itemSub}>Bill day {info.account.billingDay} · due day {info.account.dueDay}</Text>
              <Chip label="Edit" icon="create-outline" onPress={() => router.push(`/account-form?id=${info.account.id}`)} />
            </Row>
            <Row style={{ marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>{overdue ? 'Overdue' : 'Amount due'}</Text>
                <Text style={[styles.statValue, overdue && { color: colors.danger }]}>{money(info.amountDue)}</Text>
                <Text style={styles.itemSub}>
                  {info.amountDue > 0
                    ? overdue
                      ? `was due ${formatShortDate(info.dueDate)}`
                      : `by ${formatShortDate(info.dueDate)} (${info.daysToDue} days)`
                    : 'All paid'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Unbilled</Text>
                <Text style={styles.statValue}>{money(info.unbilled)}</Text>
                <Text style={styles.itemSub}>next bill {formatShortDate(info.nextStatement)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Swipe today</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>{info.freeDaysToday} days</Text>
                <Text style={styles.itemSub}>interest-free</Text>
              </View>
            </Row>
            {info.utilization !== null ? (
              <View style={{ gap: 4 }}>
                <Text style={styles.itemSub}>
                  Limit used {Math.round(info.utilization * 100)}% · {money(info.available ?? 0)} available of {money(info.account.creditLimit ?? 0)}
                </Text>
                <ProgressBar value={info.utilization} color={info.utilization > 0.3 ? colors.warning : colors.primary} plain />
              </View>
            ) : null}
            {gw ? (
              <Text style={styles.hint}>
                Golden window: {formatShortDate(gw.start)} – {formatShortDate(gw.end)} (longest free credit)
              </Text>
            ) : null}
            {info.account.rewardRate || info.account.rewardPoints ? (
              <Text style={styles.itemSub}>
                Rewards: about {money(earned)} earned since the last bill
                {info.account.rewardPoints ? ` · ${info.account.rewardPoints.toLocaleString()} points${pointsWorth ? ` worth ${money(pointsWorth)}` : ''}` : ''}
              </Text>
            ) : null}
            {info.amountDue > 0 ? (
              <Button
                title={`Pay ${money(info.amountDue)}`}
                icon="checkmark-done"
                variant={overdue ? 'danger' : 'secondary'}
                onPress={() => router.push(`/add?type=transfer&to=${info.account.id}&amount=${Math.round(info.amountDue)}`)}
              />
            ) : null}
          </Card>
        );
      })}

      {totals.spend.some((x) => x.value > 0) ? (
        <>
          <SectionTitle title="Spending by card · this cycle" />
          <Card>
            <HBars rows={totals.spend.filter((x) => x.value > 0).sort((a, b) => b.value - a.value)} format={money} />
          </Card>
        </>
      ) : null}

      {infos.length > 1 ? (
        <>
          <SectionTitle title="Interest-free days if you swipe today" />
          <Card>
            <BarChart labels={infos.map((i) => i.account.name.split(' ')[0])} series={[{ name: 'Days', color: colors.success, values: infos.map((i) => i.freeDaysToday) }]} width={chartW} height={150} format={(n) => `${Math.round(n)}d`} />
            <Text style={styles.hint}>Taller bar = more days before you have to pay.</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
