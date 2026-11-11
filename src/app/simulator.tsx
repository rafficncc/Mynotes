import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { Card, Chip, ChipRow, Icon, Row, Screen, SectionTitle, styles } from '../components/ui';
import { expenses, inMonth, sum } from '../logic/analytics';
import { shiftMonthKey, toISODate } from '../logic/dates';
import { useAppData, useMoney } from '../store/hooks';
import { colors } from '../theme';

const CUTS = [0, 10, 25, 50];

/** Future value of a monthly SIP. */
function sipValue(monthly: number, years: number, annualRate = 0.12) {
  const r = annualRate / 12;
  const n = years * 12;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

export default function Simulator() {
  const data = useAppData();
  const { money } = useMoney();
  const [cuts, setCuts] = useState<Record<string, number>>({});
  const key = toISODate(new Date()).slice(0, 7);

  const rows = useMemo(() => {
    const months = [1, 2, 3].map((i) => expenses(inMonth(data.transactions, shiftMonthKey(key, -i))));
    return data.categories
      .filter((c) => c.kind === 'want' || c.id === 'groceries' || c.id === 'transport' || c.id === 'utilities')
      .map((c) => ({ c, avg: months.reduce((s, m) => s + sum(m.filter((t) => t.categoryId === c.id)), 0) / 3 }))
      .filter((r) => r.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [data, key]);

  const monthly = rows.reduce((s, r) => s + (r.avg * (cuts[r.c.id] ?? 0)) / 100, 0);
  const goal = data.goals.find((g) => g.saved < g.target);

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.primary }}>
        <Text style={{ color: '#ffffffcc' }}>You would save</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{money(monthly)}/month</Text>
        <Text style={{ color: '#ffffffdd' }}>
          {money(monthly * 12)} a year · invested in a SIP at 12% that grows to {money(sipValue(monthly, 10))} in 10 years
        </Text>
        {goal && monthly > 0 ? (
          <Text style={{ color: '#fff', fontWeight: '700', marginTop: 4 }}>
            Reach “{goal.name}” in {Math.ceil((goal.target - goal.saved) / monthly)} months with just these savings.
          </Text>
        ) : null}
      </Card>
      <SectionTitle title="Choose what to cut" />
      {rows.length === 0 ? <Card><Text style={styles.itemSub}>Needs a month or more of expenses to simulate.</Text></Card> : null}
      {rows.map(({ c, avg }) => (
        <Card key={c.id}>
          <Row>
            <Icon name={c.icon} color={c.color} />
            <Text style={[styles.itemTitle, { flex: 1 }]}>{c.name}</Text>
            <Text style={styles.itemSub}>avg {money(avg)}/mo</Text>
          </Row>
          <ChipRow>
            {CUTS.map((p) => (
              <Chip key={p} label={p === 0 ? 'No cut' : `-${p}%`} selected={(cuts[c.id] ?? 0) === p} onPress={() => setCuts((s) => ({ ...s, [c.id]: p }))} />
            ))}
          </ChipRow>
          {(cuts[c.id] ?? 0) > 0 ? (
            <Text style={[styles.saveTag, { color: colors.success }]}>Saves {money((avg * (cuts[c.id] ?? 0)) / 100)}/month</Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
