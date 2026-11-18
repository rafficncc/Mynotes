import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Empty, Field, ListItem, Row, Screen, SectionTitle, styles } from '../components/ui';
import { formatDate, toISODate } from '../logic/dates';
import { FREQUENCY_LABEL, nextBillDate } from '../logic/recurring';
import { policyBills } from '../logic/trackers';
import type { Frequency, InsurancePolicy, PolicyType } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const TYPES: { key: PolicyType; label: string; icon: string }[] = [
  { key: 'health', label: 'Health', icon: 'medkit-outline' },
  { key: 'term', label: 'Term life', icon: 'shield-checkmark-outline' },
  { key: 'life', label: 'Life / endowment', icon: 'heart-outline' },
  { key: 'vehicle', label: 'Vehicle', icon: 'car-outline' },
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { key: 'other', label: 'Other', icon: 'document-outline' },
];
const FREQS: Frequency[] = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'once'];

export default function Policies() {
  const data = useAppData();
  const { saveItem, deleteItem } = useStore();
  const { money } = useMoney();
  const blank = { type: 'health' as PolicyType, name: '', insurer: '', policyNo: '', memberId: '', sumAssured: '', premium: '', frequency: 'yearly' as Frequency, nextDue: toISODate(new Date()), remindDaysBefore: 15, renewalDate: '', nominee: '' };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const set = (patch: Partial<typeof blank>) => setF((x) => ({ ...x, ...patch }));

  const edit = (p: InsurancePolicy) => {
    setEditing(p.id);
    setF({ type: p.type, name: p.name, insurer: p.insurer ?? '', policyNo: p.policyNo ?? '', memberId: p.memberId ?? '', sumAssured: p.sumAssured ? String(p.sumAssured) : '', premium: String(p.premium), frequency: p.frequency, nextDue: p.nextDue, remindDaysBefore: p.remindDaysBefore, renewalDate: p.renewalDate ?? '', nominee: p.nominee ?? '' });
  };
  const save = () => {
    const premium = parseFloat(f.premium);
    if (!f.name.trim() || !premium) return ask('Enter the policy name and premium');
    const old = data.policies.find((p) => p.id === editing);
    saveItem('policies', {
      id: editing ?? undefined,
      type: f.type,
      name: f.name.trim(),
      insurer: f.insurer.trim() || undefined,
      policyNo: f.policyNo.trim() || undefined,
      memberId: f.memberId || undefined,
      sumAssured: parseFloat(f.sumAssured) || undefined,
      premium,
      frequency: f.frequency,
      nextDue: f.nextDue,
      remindDaysBefore: f.remindDaysBefore,
      renewalDate: f.renewalDate || undefined,
      nominee: f.nominee.trim() || undefined,
      lastPaid: old?.nextDue === f.nextDue ? old?.lastPaid : undefined,
    });
    setEditing(null);
    setF(blank);
  };

  const yearly = data.policies.reduce((s, p) => s + p.premium * ({ monthly: 12, quarterly: 4, half_yearly: 2, yearly: 1, once: 0 } as const)[p.frequency], 0);
  const cover = data.policies.reduce((s, p) => s + (p.sumAssured ?? 0), 0);

  return (
    <Screen>
      <Card>
        <Text style={styles.itemTitle}>{data.policies.length} policies · {money(yearly)} premiums a year</Text>
        <Text style={styles.itemSub}>Total cover {money(cover)}. Premium reminders appear on the Actions tab.</Text>
      </Card>
      {data.policies.length === 0 ? <Empty icon="shield-checkmark-outline" title="No policies yet" text="Add health, term, vehicle and other policies to never miss a premium." /> : null}
      {data.policies.map((p) => {
        const due = nextBillDate(policyBills([p])[0], new Date());
        const member = data.members.find((m) => m.id === p.memberId)?.name;
        return (
          <Card key={p.id} style={{ padding: 12 }}>
            <ListItem
              icon={TYPES.find((t) => t.key === p.type)!.icon}
              title={`${p.name}${member ? ` · ${member}` : ''}`}
              subtitle={[p.insurer, p.policyNo, p.sumAssured ? `cover ${money(p.sumAssured)}` : null, p.nominee ? `nominee ${p.nominee}` : null, due ? `next premium ${formatDate(toISODate(due))}` : 'paid'].filter(Boolean).join(' · ')}
              right={money(p.premium)}
              rightSub={FREQUENCY_LABEL[p.frequency]}
              onPress={() => edit(p)}
            />
            <ChipRow>
              <Chip label="Pay premium" icon="wallet-outline" onPress={() => router.push(`/add?type=expense&policyId=${p.id}`)} />
              <Chip label="Claims" icon="medkit-outline" onPress={() => router.push('/claims')} />
            </ChipRow>
          </Card>
        );
      })}

      <SectionTitle title={editing ? 'Edit policy' : 'Add a policy'} />
      <Card>
        <ChipRow>
          {TYPES.map((t) => (
            <Chip key={t.key} label={t.label} icon={t.icon} selected={f.type === t.key} onPress={() => set({ type: t.key })} />
          ))}
        </ChipRow>
        <Field label="Policy name" value={f.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Family floater health" />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Insurer" value={f.insurer} onChangeText={(v) => set({ insurer: v })} placeholder="Company" /></View>
          <View style={{ flex: 1 }}><Field label="Policy no." value={f.policyNo} onChangeText={(v) => set({ policyNo: v })} /></View>
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Premium" value={f.premium} onChangeText={(v) => set({ premium: v })} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Sum assured" value={f.sumAssured} onChangeText={(v) => set({ sumAssured: v })} keyboardType="decimal-pad" /></View>
        </Row>
        <ChipRow>
          {FREQS.map((x) => (
            <Chip key={x} label={FREQUENCY_LABEL[x]} selected={f.frequency === x} onPress={() => set({ frequency: x })} />
          ))}
        </ChipRow>
        <DateField label="Next premium due" value={f.nextDue} onChange={(v) => set({ nextDue: v })} quick={false} />
        <DateField label="Policy end / renewal date (optional)" value={f.renewalDate} onChange={(v) => set({ renewalDate: v })} optional quick={false} />
        <Text style={styles.label}>Remind me</Text>
        <ChipRow>
          {[3, 7, 15, 30].map((d) => (
            <Chip key={d} label={`${d} days before`} selected={f.remindDaysBefore === d} onPress={() => set({ remindDaysBefore: d })} />
          ))}
        </ChipRow>
        <Text style={styles.label}>Insured person</Text>
        <ChipRow>
          <Chip label="Whole family" selected={!f.memberId} onPress={() => set({ memberId: '' })} />
          {data.members.map((m) => (
            <Chip key={m.id} label={m.name} selected={f.memberId === m.id} onPress={() => set({ memberId: m.id })} />
          ))}
        </ChipRow>
        <Field label="Nominee" value={f.nominee} onChangeText={(v) => set({ nominee: v })} placeholder="Name and relation" />
        <Button title={editing ? 'Save policy' : 'Add policy'} icon="checkmark" onPress={save} />
        {editing ? (
          <Button
            title="Delete policy"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              ask('Delete this policy?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { deleteItem('policies', editing); setEditing(null); setF(blank); } },
              ])
            }
          />
        ) : null}
        {editing ? <Text style={[styles.hint, { color: colors.muted }]}>Tip: the nominee also appears in the Money vault.</Text> : null}
      </Card>
    </Screen>
  );
}
