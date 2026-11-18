import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Field, Icon, ProgressBar, Row, Screen, SectionTitle, styles } from '../components/ui';
import { toISODate } from '../logic/dates';
import { badges, challengeProgress, memberStreaks, nextSaturday } from '../logic/motivation';
import type { ChallengeType } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const NEW: { type: ChallengeType; label: string; icon: string; hint: string }[] = [
  { type: 'no_spend_weekend', label: 'No-spend weekend', icon: 'calendar-outline', hint: 'No treats, eating out or shopping this Saturday and Sunday.' },
  { type: 'no_category_week', label: 'A week without…', icon: 'ban-outline', hint: 'Pick one category (e.g. food delivery) and skip it for 7 days.' },
  { type: 'week52', label: '52-week challenge', icon: 'stats-chart-outline', hint: 'Save a bit more each week: week 1 × amount, week 2 × 2… for a year.' },
  { type: 'save_target', label: 'Save an amount this month', icon: 'cash-outline', hint: 'Income minus spending over the next month.' },
];

export default function Challenges() {
  const data = useAppData();
  const { saveItem, deleteItem } = useStore();
  const { money } = useMoney();
  const on = new Date();
  const [type, setType] = useState<ChallengeType>('no_spend_weekend');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('dining');
  const [memberId, setMemberId] = useState('');
  const list = useMemo(() => data.challenges.map((c) => ({ c, p: challengeProgress(c, data, on, money) })), [data, money]); // eslint-disable-line react-hooks/exhaustive-deps
  const allBadges = useMemo(() => badges(data, on), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const streaks = useMemo(() => memberStreaks(data, on), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    if ((type === 'week52' || type === 'save_target') && !parseFloat(amount)) return ask('Enter an amount');
    saveItem('challenges', {
      type,
      startDate: type === 'no_spend_weekend' ? nextSaturday(on) : toISODate(on),
      amount: parseFloat(amount) || undefined,
      categoryId: type === 'no_category_week' ? categoryId : undefined,
      memberId: memberId || undefined,
      done: type === 'week52' ? [] : undefined,
    });
    setAmount('');
  };

  const stateColor = { upcoming: colors.info, active: colors.primary, won: colors.success, lost: colors.danger } as const;

  return (
    <Screen>
      {list.map(({ c, p }) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[styles.itemTitle, { flex: 1 }]}>{p.title}{c.memberId ? ` · ${data.members.find((m) => m.id === c.memberId)?.name ?? ''}` : ''}</Text>
            <Text style={{ color: stateColor[p.state], fontWeight: '700' }}>{p.state === 'won' ? '🏆 Won' : p.state === 'lost' ? 'Missed' : p.state === 'active' ? 'On' : 'Soon'}</Text>
          </Row>
          <ProgressBar value={p.progress} color={stateColor[p.state]} plain />
          <Text style={styles.itemSub}>{p.detail}</Text>
          {c.type === 'week52' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => {
                const done = c.done?.includes(w);
                return (
                  <Pressable
                    key={w}
                    onPress={() => saveItem('challenges', { ...c, done: done ? c.done!.filter((x) => x !== w) : [...(c.done ?? []), w] })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!done }}
                    accessibilityLabel={`Week ${w}`}
                    style={{ width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.success : colors.bg }}
                  >
                    <Text style={{ fontSize: 10, color: done ? '#fff' : colors.muted }}>{w}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Chip label="Remove" icon="close" onPress={() => deleteItem('challenges', c.id)} />
        </Card>
      ))}

      <SectionTitle title="Start a challenge" />
      <Card>
        <ChipRow>
          {NEW.map((n) => (
            <Chip key={n.type} label={n.label} icon={n.icon} selected={type === n.type} onPress={() => setType(n.type)} />
          ))}
        </ChipRow>
        <Text style={styles.itemSub}>{NEW.find((n) => n.type === type)!.hint}</Text>
        {type === 'no_category_week' ? (
          <ChipRow>
            {data.categories.filter((c) => c.kind === 'want').map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ChipRow>
        ) : null}
        {type === 'week52' || type === 'save_target' ? (
          <Field label={type === 'week52' ? 'Amount for week 1' : 'Amount to save'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={type === 'week52' ? '50' : '10000'} hint={type === 'week52' && parseFloat(amount) ? `You’ll save ${money(parseFloat(amount) * 1378)} in a year.` : undefined} />
        ) : null}
        {type !== 'week52' && type !== 'save_target' && data.members.length > 1 ? (
          <ChipRow>
            <Chip label="Whole family" selected={!memberId} onPress={() => setMemberId('')} />
            {data.members.map((m) => (
              <Chip key={m.id} label={m.name} selected={memberId === m.id} onPress={() => setMemberId(m.id)} />
            ))}
          </ChipRow>
        ) : null}
        <Button title="Start" icon="flag-outline" onPress={start} />
      </Card>

      <SectionTitle title="Family streaks (days without treats)" />
      <Card>
        {streaks.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between' }}>
            <Text style={styles.itemTitle}>{s.name}</Text>
            <Text style={[styles.itemTitle, { color: colors.accent }]}>🔥 {s.streak} day{s.streak === 1 ? '' : 's'}</Text>
          </Row>
        ))}
      </Card>

      <SectionTitle title={`Badges · ${allBadges.filter((b) => b.earned).length} of ${allBadges.length}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {allBadges.map((b) => (
          <View key={b.id} style={{ width: '30%', minWidth: 96, flexGrow: 1, alignItems: 'center', gap: 4, padding: 10, borderRadius: 14, backgroundColor: b.earned ? colors.successSoft : colors.card, opacity: b.earned ? 1 : 0.55 }} accessibilityLabel={`${b.title}: ${b.detail}. ${b.earned ? 'Earned' : 'Not yet earned'}`}>
            <Icon name={b.icon} size={28} color={b.earned ? colors.success : colors.muted} />
            <Text style={[styles.itemTitle, { fontSize: 13, textAlign: 'center' }]}>{b.title}</Text>
            <Text style={[styles.hint, { textAlign: 'center' }]}>{b.detail}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
