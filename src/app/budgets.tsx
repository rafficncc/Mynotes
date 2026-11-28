import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Gauge } from '../components/charts';
import { GradientBg } from '../components/GradientBg';
import { Icon, Row, Screen, styles } from '../components/ui';
import { expenses, inMonth, projectMonthSpend, sum } from '../logic/analytics';
import { shiftMonthKey } from '../logic/dates';
import { useAppData, useCycle, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors, isDark } from '../theme';

export default function Budgets() {
  const data = useAppData();
  const setBudget = useStore((s) => s.setBudget);
  const { money } = useMoney();
  const on = new Date();
  const { key, startDay, label: cycleText } = useCycle();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const month = expenses(inMonth(data.transactions, key, startDay));
    const prev3 = [1, 2, 3].map((i) => expenses(inMonth(data.transactions, shiftMonthKey(key, -i), startDay)));
    return data.categories
      .filter((c) => c.kind !== 'income')
      .map((c) => {
        const spent = sum(month.filter((t) => t.categoryId === c.id));
        const avg = prev3.reduce((s, m) => s + sum(m.filter((t) => t.categoryId === c.id)), 0) / 3;
        const limit = data.budgets.find((b) => b.categoryId === c.id)?.monthlyLimit ?? 0;
        return { c, spent, avg, limit, projected: projectMonthSpend(spent, on, startDay) };
      })
      .sort((a, b) => (b.limit > 0 ? 1 : 0) - (a.limit > 0 ? 1 : 0) || b.avg - a.avg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key, startDay]);

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

  const budgeted = rows.filter((r) => r.limit > 0);
  const status = (r: (typeof rows)[number]) => (r.spent > r.limit ? 'over' : r.spent > r.limit * 0.85 || r.projected > r.limit ? 'near' : 'ok');
  const counts = { over: budgeted.filter((r) => status(r) === 'over').length, near: budgeted.filter((r) => status(r) === 'near').length, ok: budgeted.filter((r) => status(r) === 'ok').length };
  const left = totalLimit - totalSpent;

  const row = ({ c, spent, avg, limit, projected }: (typeof rows)[number]) => {
    const st = limit > 0 ? status({ c, spent, avg, limit, projected }) : null;
    const tone = st === 'over' ? CORAL : st === 'near' ? GOLD : MINT;
    const toneText = isDark ? tone : st === 'over' ? colors.danger : st === 'near' ? colors.warning : colors.success;
    return (
      <View key={c.id} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border }}>
        <Row style={{ gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <GradientBg id={`bud${c.id.replace(/[^a-zA-Z0-9]/g, '')}`} colors={[c.color, c.color + 'B3']} />
            <Icon name={c.icon} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Spent <Text style={{ color: colors.text, fontWeight: '800' }}>{money(spent)}</Text>
              {avg > 0 ? ` · avg ${money(avg)}` : ''}
            </Text>
          </View>
          <View style={{ width: 104 }}>
            <TextInput
              value={drafts[c.id] ?? (limit ? String(limit) : '')}
              onChangeText={(v) => setDrafts((d) => ({ ...d, [c.id]: v }))}
              onEndEditing={() => commit(c.id)}
              onBlur={() => commit(c.id)}
              placeholder={avg > 0 ? `${Math.round((avg * 0.9) / 100) * 100}` : 'Set limit'}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              accessibilityLabel={`${c.name} monthly limit`}
              style={[styles.input, { paddingVertical: 8, textAlign: 'right', borderRadius: 12, fontWeight: '700' }]}
            />
          </View>
        </Row>
        {limit > 0 ? (
          <>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border }}>
              <View style={{ width: `${Math.min(100, Math.max(2, (spent / limit) * 100))}%`, height: '100%', borderRadius: 4, backgroundColor: tone }} />
              {/* where you'll be by the end of the cycle at this pace */}
              {projected > spent ? <View style={{ position: 'absolute', left: `${Math.min(99, (projected / limit) * 100)}%`, top: -3, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.muted }} /> : null}
            </View>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: tone + '33', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: toneText, fontSize: 11, fontWeight: '800' }}>
                  {st === 'over' ? `${money(spent - limit)} over` : st === 'near' ? 'Near the limit' : 'On track'}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {spent <= limit ? `${money(limit - spent)} left · ` : ''}heading to {money(projected)}
              </Text>
            </Row>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <GradientBg id="budhero" />
        <View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff10', top: -80, right: -60 }} />
        <View style={{ padding: 16, gap: 14 }}>
          <Row style={{ gap: 16 }}>
            <Gauge value={totalLimit ? totalSpent / totalLimit : 0} size={104} label={totalLimit ? `${Math.round((totalSpent / totalLimit) * 100)}%` : '–'} sub="used" light />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: '#ffffffb3', fontSize: 13 }}>{cycleText} budget</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{money(totalLimit)}</Text>
              <Text style={{ color: '#ffffffd9', fontSize: 13 }}>Spent {money(totalSpent)}</Text>
              <Text style={{ color: left < 0 ? CORAL : MINT, fontSize: 14, fontWeight: '800' }}>{totalLimit ? (left < 0 ? `${money(-left)} over budget` : `${money(left)} left`) : 'No limits set yet'}</Text>
            </View>
          </Row>
          {budgeted.length ? (
            <Row style={{ gap: 8 }}>
              {(
                [
                  ['over', 'Over', CORAL, 'alert-circle'],
                  ['near', 'Near limit', GOLD, 'warning'],
                  ['ok', 'On track', MINT, 'checkmark-circle'],
                ] as const
              ).map(([k, label, c, icon]) => (
                <View key={k} style={{ flex: 1, backgroundColor: '#ffffff1a', borderRadius: 12, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
                  <Icon name={icon} size={16} color={c} />
                  <Text style={{ color: c, fontSize: 20, fontWeight: '900' }}>{counts[k]}</Text>
                  <Text style={{ color: '#ffffffd9', fontSize: 11, fontWeight: '700' }}>{label}</Text>
                </View>
              ))}
            </Row>
          ) : null}
          <Text style={{ color: '#ffffffb3', fontSize: 12 }}>💡 Start about 10% below your 3-month average. The grey box shows a suggested limit for each category.</Text>
        </View>
      </View>

      {budgeted.length ? <Section title="With a limit" color={MINT} count={budgeted.length} /> : null}
      {budgeted.map(row)}
      <Section title="No limit yet" color={BLUE} count={rows.length - budgeted.length} />
      {rows.filter((r) => !r.limit).map(row)}
    </Screen>
  );
}

const MINT = '#7EE3B5';
const GOLD = '#FFD978';
const CORAL = '#FF9E8A';
const BLUE = '#9CC3FF';

function Section({ title, color, count }: { title: string; color: string; count: number }) {
  return (
    <Row style={{ gap: 8, marginTop: 6 }}>
      <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted, flex: 1 }}>{title.toUpperCase()}</Text>
      <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>{count}</Text>
    </Row>
  );
}
