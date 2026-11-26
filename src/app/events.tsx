import { premiumOnly } from '../components/PremiumGate';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { HBars } from '../components/charts';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Empty, Field, ListItem, ProgressBar, Row, Screen, SectionTitle, styles } from '../components/ui';
import { spendByCategory } from '../logic/analytics';
import { formatDate, toISODate } from '../logic/dates';
import type { EventBudget } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const KINDS: { key: EventBudget['kind']; label: string; icon: string }[] = [
  { key: 'trip', label: 'Trip', icon: 'airplane-outline' },
  { key: 'wedding', label: 'Wedding', icon: 'heart-outline' },
  { key: 'festival', label: 'Festival', icon: 'sparkles-outline' },
  { key: 'move', label: 'House move', icon: 'cube-outline' },
  { key: 'party', label: 'Party', icon: 'balloon-outline' },
  { key: 'other', label: 'Other', icon: 'flag-outline' },
];

function Events() {
  const data = useAppData();
  const { saveItem, deleteItem } = useStore();
  const { money } = useMoney();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<EventBudget['kind']>('trip');
  const [budget, setBudget] = useState('');
  const [start, setStart] = useState(toISODate(new Date()));
  const [end, setEnd] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const spent = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data.transactions) if (t.type === 'expense' && t.eventId) m.set(t.eventId, (m.get(t.eventId) ?? 0) + t.amount);
    return m;
  }, [data.transactions]);

  const edit = (e: EventBudget) => {
    setEditing(e.id);
    setName(e.name);
    setKind(e.kind);
    setBudget(String(e.budget));
    setStart(e.startDate);
    setEnd(e.endDate ?? '');
  };
  const reset = () => {
    setEditing(null);
    setName('');
    setBudget('');
    setEnd('');
  };
  const save = () => {
    if (!name.trim()) return ask('Name the event', 'e.g. Goa trip, Priya’s wedding, Onam');
    saveItem('events', { id: editing ?? undefined, name: name.trim(), kind, budget: parseFloat(budget) || 0, startDate: start, endDate: end || undefined });
    reset();
  };

  const sorted = [...data.events].sort((a, b) => Number(!!a.closed) - Number(!!b.closed) || b.startDate.localeCompare(a.startDate));

  return (
    <Screen>
      <Text style={styles.itemSub}>Tag expenses with an event when you add them to see the total cost of a trip, wedding or festival.</Text>
      {sorted.length === 0 ? <Empty icon="calendar-outline" title="No events yet" text="Create one below, e.g. “Kerala trip – ₹60,000”." /> : null}
      {sorted.map((e) => {
        const used = spent.get(e.id) ?? 0;
        const k = KINDS.find((x) => x.key === e.kind)!;
        const txns = data.transactions.filter((t) => t.eventId === e.id);
        return (
          <Card key={e.id} style={e.closed ? { opacity: 0.7 } : undefined}>
            <ListItem
              icon={k.icon}
              title={`${e.name}${e.closed ? ' · finished' : ''}`}
              subtitle={`${formatDate(e.startDate)}${e.endDate ? ` – ${formatDate(e.endDate)}` : ''} · ${txns.length} spends`}
              right={money(used)}
              rightSub={e.budget ? `of ${money(e.budget)}` : undefined}
              onPress={() => setOpen(open === e.id ? null : e.id)}
            />
            {e.budget ? <ProgressBar value={used / e.budget} /> : null}
            {e.budget ? (
              <Text style={[styles.hint, used > e.budget && { color: colors.danger }]}>
                {used > e.budget ? `${money(used - e.budget)} over budget` : `${money(e.budget - used)} left`}
              </Text>
            ) : null}
            {open === e.id ? (
              <View style={{ gap: 8 }}>
                {txns.length ? <HBars rows={spendByCategory(txns, data.categories).map((c) => ({ label: c.label, value: c.value, color: c.color }))} format={money} /> : null}
                <ChipRow>
                  <Chip label="Edit" icon="create-outline" onPress={() => edit(e)} />
                  <Chip label={e.closed ? 'Reopen' : 'Mark finished'} icon="flag-outline" onPress={() => saveItem('events', { ...e, closed: !e.closed })} />
                  <Chip
                    label="Delete"
                    icon="trash-outline"
                    onPress={() =>
                      ask('Delete this event?', 'Its expenses stay, just without the event tag.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteItem('events', e.id) },
                      ])
                    }
                  />
                </ChipRow>
              </View>
            ) : null}
          </Card>
        );
      })}

      <SectionTitle title={editing ? 'Edit event' : 'New event'} />
      <Card>
        <ChipRow>
          {KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </ChipRow>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Kerala trip" />
        <Field label="Budget (optional)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="60000" />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><DateField label="Starts" value={start} onChange={setStart} quick={false} /></View>
          <View style={{ flex: 1 }}><DateField label="Ends (optional)" value={end} onChange={setEnd} optional quick={false} /></View>
        </Row>
        <Button title={editing ? 'Save event' : 'Create event'} icon="checkmark" onPress={save} />
        {editing ? <Button title="Cancel" variant="secondary" onPress={reset} /> : null}
      </Card>
    </Screen>
  );
}

export default premiumOnly(Events, 'Events & trips', 'Set a budget for a wedding, trip or festival and track every spend.');
