import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Empty, Field, Icon, ProgressBar, Row, Screen, SectionTitle, styles } from '../../components/ui';
import { cardCycleInfo, goldenWindow, isCreditCardConfigured, recommendCards } from '../../logic/creditCard';
import { addDays, formatShortDate } from '../../logic/dates';
import { useAppData, useBalances, useMoney } from '../../store/hooks';
import { colors } from '../../theme';

const WHEN = [
  { label: 'Today', days: 0 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 15 days', days: 15 },
];

export default function SmartCard() {
  const data = useAppData();
  const balances = useBalances();
  const { money } = useMoney();
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
        const gw = goldenWindow(info.account, on);
        const overdue = info.amountDue > 0 && info.daysToDue < 0;
        return (
          <Card key={info.account.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>{info.account.name}</Text>
              <Chip label="Edit" icon="create-outline" onPress={() => router.push(`/account-form?id=${info.account.id}`)} />
            </Row>
            <Text style={styles.itemSub}>
              Bill generated on day {info.account.billingDay} · due on day {info.account.dueDay}
            </Text>
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
    </Screen>
  );
}
