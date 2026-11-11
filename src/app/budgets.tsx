import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Card, Icon, ProgressBar, Row, Screen, styles } from '../components/ui';
import { expenses, inMonth, projectMonthSpend, sum } from '../logic/analytics';
import { shiftMonthKey, toISODate } from '../logic/dates';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Budgets() {
  const data = useAppData();
  const setBudget = useStore((s) => s.setBudget);
  const { money } = useMoney();
  const on = new Date();
  const key = toISODate(on).slice(0, 7);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const month = expenses(inMonth(data.transactions, key));
    const prev3 = [1, 2, 3].map((i) => expenses(inMonth(data.transactions, shiftMonthKey(key, -i))));
    return data.categories
      .filter((c) => c.kind !== 'income')
      .map((c) => {
        const spent = sum(month.filter((t) => t.categoryId === c.id));
        const avg = prev3.reduce((s, m) => s + sum(m.filter((t) => t.categoryId === c.id)), 0) / 3;
        const limit = data.budgets.find((b) => b.categoryId === c.id)?.monthlyLimit ?? 0;
        return { c, spent, avg, limit, projected: projectMonthSpend(spent, on) };
      })
      .sort((a, b) => (b.limit > 0 ? 1 : 0) - (a.limit > 0 ? 1 : 0) || b.avg - a.avg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key]);

  const commit = (categoryId: string) => {
    const v = drafts[categoryId];
    if (v === undefined) return;
    setBudget({ categoryId, monthlyLimit: parseFloat(v) || 0 });
    setDrafts((d) => {
      const { [categoryId]: _, ...rest } = d;
      return rest;
    });
  };

  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.filter((r) => r.limit > 0).reduce((s, r) => s + r.spent, 0);

  return (
    <Screen>
      <Card>
        <Text style={styles.itemTitle}>This month: {money(totalSpent)} of {money(totalLimit)} budgeted</Text>
        {totalLimit > 0 ? <ProgressBar value={totalSpent / totalLimit} /> : null}
        <Text style={styles.hint}>Tip: start with a budget about 10% below your 3-month average – the app suggests one for each category.</Text>
      </Card>
      {rows.map(({ c, spent, avg, limit, projected }) => (
        <Card key={c.id} style={{ gap: 6 }}>
          <Row>
            <Icon name={c.icon} color={c.color} />
            <Text style={[styles.itemTitle, { flex: 1 }]}>{c.name}</Text>
            <View style={{ width: 110 }}>
              <TextInput
                value={drafts[c.id] ?? (limit ? String(limit) : '')}
                onChangeText={(v) => setDrafts((d) => ({ ...d, [c.id]: v }))}
                onEndEditing={() => commit(c.id)}
                onBlur={() => commit(c.id)}
                placeholder={avg > 0 ? `${Math.round((avg * 0.9) / 100) * 100}` : 'No limit'}
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={[styles.input, { paddingVertical: 8, textAlign: 'right' }]}
              />
            </View>
          </Row>
          {limit > 0 ? <ProgressBar value={spent / limit} /> : null}
          <Text style={styles.itemSub}>
            Spent {money(spent)}
            {limit > 0 ? ` · ${spent > limit ? `${money(spent - limit)} over` : `${money(limit - spent)} left`} · projected ${money(projected)}` : ''}
            {avg > 0 ? ` · 3-month avg ${money(avg)}` : ''}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
