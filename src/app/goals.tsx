import { ask } from '../components/Dialog';
import { useState } from 'react';
import { DateField } from '../components/DateField';
import { Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Empty, Field, ProgressBar, Row, Screen, SectionTitle, styles } from '../components/ui';
import { diffDays, formatDate, parseDate } from '../logic/dates';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';

export default function Goals() {
  const data = useAppData();
  const { addGoal, updateGoal, deleteGoal } = useStore();
  const { money } = useMoney();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');

  const add = () => {
    const t = parseFloat(target);
    if (!name.trim() || !t) return ask('Enter a goal name and target amount');
    addGoal({ name: name.trim(), target: t, saved: 0, deadline: deadline || undefined });
    setName('');
    setTarget('');
    setDeadline('');
  };

  return (
    <Screen>
      {data.goals.length === 0 ? <Empty icon="flag-outline" title="No goals yet" text="Saving for something specific makes it much easier to cut spending." /> : null}
      {data.goals.map((g) => {
        const left = Math.max(0, g.target - g.saved);
        const days = g.deadline ? diffDays(parseDate(g.deadline), new Date()) : null;
        const perMonth = days && days > 0 ? left / (days / 30) : null;
        return (
          <Card key={g.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>{g.name}</Text>
              <Text style={styles.itemTitle}>{Math.round((g.saved / g.target) * 100)}%</Text>
            </Row>
            <ProgressBar value={g.saved / g.target} plain />
            <Text style={styles.itemSub}>
              {money(g.saved)} of {money(g.target)}
              {g.deadline ? ` · by ${formatDate(g.deadline)}` : ''}
              {perMonth ? ` · save ${money(perMonth)}/month to make it` : ''}
            </Text>
            <ChipRow>
              {[500, 1000, 5000].map((n) => (
                <Chip key={n} label={`+${money(n)}`} onPress={() => updateGoal(g.id, { saved: g.saved + n })} />
              ))}
              <Chip
                label="Delete"
                icon="trash-outline"
                onPress={() =>
                  ask('Delete goal?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteGoal(g.id) },
                  ])
                }
              />
            </ChipRow>
          </Card>
        );
      })}
      <SectionTitle title="New goal" />
      <Card>
        <Field label="Goal" value={name} onChangeText={setName} placeholder="e.g. Kids school fees, Goa trip" />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="50000" /></View>
        </Row>
        <DateField label="Deadline (optional)" value={deadline} onChange={setDeadline} optional quick={false} />
        <Button title="Add goal" icon="add" onPress={add} />
      </Card>
    </Screen>
  );
}
