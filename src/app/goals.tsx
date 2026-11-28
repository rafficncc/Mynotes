import { useNavigation } from 'expo-router';
import { ask } from '../components/Dialog';
import { useEffect, useState } from 'react';
import { DateField } from '../components/DateField';
import { Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Empty, Field, ProgressBar, Row, Screen, SectionTitle, Stat, styles, HeaderAdd } from '../components/ui';
import { diffDays, formatDate, parseDate, toISODate } from '../logic/dates';
import { toast } from '../components/Toast';
import { notifyBalance, useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Goals() {
  const data = useAppData();
  const { addGoal, updateGoal, deleteGoal, addTransaction } = useStore();
  const { money } = useMoney();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const formOpen = adding;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Add a goal" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);
  const close = () => setAdding(false);
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [autoFor, setAutoFor] = useState<string | null>(null);
  const [autoAmount, setAutoAmount] = useState('');
  const [autoDay, setAutoDay] = useState('1');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const accounts = data.accounts.filter((a) => !a.archived && a.type !== 'people');

  // With accounts set on the goal, money really moves (e.g. bank → savings account); otherwise it is earmarked only.
  const addToGoal = (id: string, n: number) => {
    const g = data.goals.find((x) => x.id === id)!;
    updateGoal(id, { saved: g.saved + n });
    if (g.fromAccountId && g.toAccountId) {
      addTransaction({ type: 'transfer', amount: n, date: toISODate(new Date()), accountId: g.fromAccountId, toAccountId: g.toAccountId, note: `Saved for ${g.name}` });
      notifyBalance(g.fromAccountId, `Moved ${money(n)} to “${g.name}”`);
    } else {
      toast(`Counted ${money(n)} towards “${g.name}”. To move money between accounts, set it in Auto-save.`);
    }
  };

  const openAuto = (id: string) => {
    const g = data.goals.find((x) => x.id === id)!;
    setAutoFor(id);
    setAutoAmount(g.autoAmount ? String(g.autoAmount) : '');
    setAutoDay(String(g.autoDay ?? 1));
    setFromAccountId(g.fromAccountId ?? '');
    setToAccountId(g.toAccountId ?? '');
  };
  const saveAuto = () => {
    const amt = parseFloat(autoAmount) || undefined;
    const day = Math.min(28, Math.max(1, parseInt(autoDay, 10) || 1));
    updateGoal(autoFor!, { autoAmount: amt, autoDay: amt ? day : undefined, fromAccountId: fromAccountId || undefined, toAccountId: toAccountId || undefined });
    setAutoFor(null);
  };

  const add = () => {
    const t = parseFloat(target);
    if (!name.trim() || !t) return ask('Enter a goal name and target amount');
    addGoal({ name: name.trim(), target: t, saved: 0, deadline: deadline || undefined });
    setName('');
    setTarget('');
    setDeadline('');
    setAdding(false);
  };

  const totalSaved = data.goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = data.goals.reduce((s, g) => s + g.target, 0);
  if (formOpen) {
    return (
      <Screen>
        <SectionTitle title="New goal" />
        <Card>
          <Field label="Goal" value={name} onChangeText={setName} placeholder="e.g. Kids school fees, Goa trip" />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="50000" /></View>
          </Row>
          <DateField label="Deadline (optional)" value={deadline} onChange={setDeadline} optional quick={false} />
          <Button title="Add goal" icon="add" onPress={add} />
          <Button title="Cancel" variant="secondary" onPress={close} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {data.goals.length ? (
        <Card gradient>
          <Row>
            <Stat light label="Saved so far" value={money(totalSaved)} color={colors.success} />
            <Stat light label="Target" value={money(totalTarget)} />
            <Stat light label="Goals" value={`${data.goals.filter((g) => g.saved < g.target).length} active`} color={colors.warning} />
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#ffffff26', overflow: 'hidden' }}>
            <View style={{ width: `${totalTarget ? Math.min(100, (totalSaved / totalTarget) * 100) : 0}%`, height: '100%', borderRadius: 4, backgroundColor: '#7EE3B5' }} />
          </View>
          <Text style={{ color: '#ffffffb3', fontSize: 12 }}>{totalTarget ? `${Math.round((totalSaved / totalTarget) * 100)}% of all goals reached` : ''}</Text>
        </Card>
      ) : null}
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
            {g.autoAmount ? <Text style={styles.itemSub}>Auto-saves {money(g.autoAmount)} on day {g.autoDay} every month</Text> : null}
            <ChipRow>
              <Chip label={g.autoAmount ? 'Auto-save' : 'Set auto-save'} icon="repeat-outline" selected={!!g.autoAmount} onPress={() => openAuto(g.id)} />
              {[500, 1000, 5000].map((n) => (
                <Chip key={n} label={`+${money(n)}`} onPress={() => addToGoal(g.id, n)} />
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
      {autoFor ? (
        <Card>
          <Text style={styles.itemTitle}>Automatic monthly saving</Text>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Amount each month" value={autoAmount} onChangeText={setAutoAmount} keyboardType="decimal-pad" placeholder="e.g. 2000" /></View>
            <View style={{ flex: 1 }}><Field label="On day (1–28)" value={autoDay} onChangeText={setAutoDay} keyboardType="number-pad" /></View>
          </Row>
          <Text style={styles.label}>Move money from (optional)</Text>
          <ChipRow>
            <Chip label="Just count it" selected={!fromAccountId} onPress={() => setFromAccountId('')} />
            {accounts.map((a) => (
              <Chip key={a.id} label={a.name} selected={fromAccountId === a.id} onPress={() => setFromAccountId(a.id)} />
            ))}
          </ChipRow>
          {fromAccountId ? (
            <>
              <Text style={styles.label}>…into</Text>
              <ChipRow>
                {accounts.filter((a) => a.id !== fromAccountId).map((a) => (
                  <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
                ))}
              </ChipRow>
            </>
          ) : null}
          <Text style={styles.hint}>Each month on that day the goal grows by this amount{fromAccountId && toAccountId ? ', and a transfer between the two accounts is recorded' : ''}. Leave the amount empty to turn auto-save off.</Text>
          <Row>
            <View style={{ flex: 1 }}><Button title="Save" onPress={saveAuto} /></View>
            <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={() => setAutoFor(null)} /></View>
          </Row>
        </Card>
      ) : null}
      <Button title="Add a goal" icon="add" onPress={() => setAdding(true)} />
    </Screen>
  );
}
