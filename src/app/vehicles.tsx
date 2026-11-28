import { premiumOnly } from '../components/PremiumGate';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Empty, Field, Row, Screen, SectionTitle, Stat, styles, HeaderAdd } from '../components/ui';
import { diffDays, formatDate, parseDate } from '../logic/dates';
import { mileage } from '../logic/trackers';
import type { Vehicle } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

function Vehicles() {
  const data = useAppData();
  const { saveItem, deleteItem } = useStore();
  const { money } = useMoney();
  const blank = { name: '', regNo: '', insuranceExpiry: '', pucExpiry: '', nextServiceDate: '', nextServiceKm: '', remindDaysBefore: 15 };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const formOpen = adding || !!editing;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Add a vehicle" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);
  const close = () => {
    setEditing(null);
    setAdding(false);
    setF(blank);
  };
  const set = (patch: Partial<typeof blank>) => setF((x) => ({ ...x, ...patch }));

  const edit = (v: Vehicle) => {
    setEditing(v.id);
    setF({ name: v.name, regNo: v.regNo ?? '', insuranceExpiry: v.insuranceExpiry ?? '', pucExpiry: v.pucExpiry ?? '', nextServiceDate: v.nextServiceDate ?? '', nextServiceKm: v.nextServiceKm ? String(v.nextServiceKm) : '', remindDaysBefore: v.remindDaysBefore });
  };
  const save = () => {
    if (!f.name.trim()) return ask('Name the vehicle', 'e.g. Swift, Activa');
    saveItem('vehicles', {
      id: editing ?? undefined,
      name: f.name.trim(),
      regNo: f.regNo.trim() || undefined,
      insuranceExpiry: f.insuranceExpiry || undefined,
      pucExpiry: f.pucExpiry || undefined,
      nextServiceDate: f.nextServiceDate || undefined,
      nextServiceKm: parseFloat(f.nextServiceKm) || undefined,
      remindDaysBefore: f.remindDaysBefore,
    });
    close();
  };

  const due = (label: string, date?: string) => {
    if (!date) return null;
    const days = diffDays(parseDate(date), new Date());
    return (
      <Text style={[styles.itemSub, days < 0 ? { color: colors.danger } : days <= 30 ? { color: colors.warning } : null]}>
        {label}: {formatDate(date)} {days < 0 ? '(expired)' : `(${days} days)`}
      </Text>
    );
  };

  if (formOpen) {
    return (
      <Screen>
        <SectionTitle title={editing ? 'Edit vehicle' : 'Add a vehicle'} />
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Name" value={f.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Swift" /></View>
            <View style={{ flex: 1 }}><Field label="Registration no." value={f.regNo} onChangeText={(v) => set({ regNo: v })} placeholder="KA 01 AB 1234" /></View>
          </Row>
          <DateField label="Insurance expires" value={f.insuranceExpiry} onChange={(v) => set({ insuranceExpiry: v })} optional quick={false} />
          <DateField label="PUC / emission test expires" value={f.pucExpiry} onChange={(v) => set({ pucExpiry: v })} optional quick={false} />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><DateField label="Next service date" value={f.nextServiceDate} onChange={(v) => set({ nextServiceDate: v })} optional quick={false} /></View>
            <View style={{ flex: 1 }}><Field label="…or at km" value={f.nextServiceKm} onChangeText={(v) => set({ nextServiceKm: v })} keyboardType="number-pad" /></View>
          </Row>
          <Text style={styles.label}>Remind me</Text>
          <ChipRow>
            {[7, 15, 30].map((d) => (
              <Chip key={d} label={`${d} days before`} selected={f.remindDaysBefore === d} onPress={() => set({ remindDaysBefore: d })} />
            ))}
          </ChipRow>
          <Button title={editing ? 'Save vehicle' : 'Add vehicle'} icon="checkmark" onPress={save} />
          {editing ? (
            <Button title="Delete vehicle" variant="danger" icon="trash-outline" onPress={() => ask('Delete this vehicle?', 'Its fuel expenses stay.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteItem('vehicles', editing); close(); } }])} />
          ) : null}
          <Button title="Cancel" variant="secondary" onPress={close} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.itemSub}>When you add a fuel expense, pick the vehicle and enter the odometer and litres to track mileage.</Text>
      {data.vehicles.length === 0 ? <Empty icon="car-outline" title="No vehicles yet" /> : null}
      {data.vehicles.map((v) => {
        const m = mileage(data.transactions, v.id);
        const spent = data.transactions.filter((t) => t.vehicleId === v.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return (
          <Card key={v.id}>
            <Text style={styles.sectionTitle}>{v.name}{v.regNo ? ` · ${v.regNo}` : ''}</Text>
            <Row>
              <Stat label="Mileage" value={m.kmPerLitre ? `${m.kmPerLitre} km/l` : '–'} />
              <Stat label="Cost per km" value={m.costPerKm ? money(m.costPerKm) : '–'} />
              <Stat label="Total spent" value={money(spent)} />
            </Row>
            {m.lastOdometer ? <Text style={styles.itemSub}>Odometer {m.lastOdometer.toLocaleString()} km{v.nextServiceKm ? ` · service due at ${v.nextServiceKm.toLocaleString()} km` : ''}</Text> : null}
            {due('Insurance', v.insuranceExpiry)}
            {due('PUC / emission test', v.pucExpiry)}
            {due('Next service', v.nextServiceDate)}
            <ChipRow>
              <Chip label="Add fuel" icon="water-outline" selected onPress={() => router.push(`/add?type=expense&vehicleId=${v.id}`)} />
              <Chip label="Edit" icon="create-outline" onPress={() => edit(v)} />
            </ChipRow>
          </Card>
        );
      })}

      <Button title="Add a vehicle" icon="add" onPress={() => setAdding(true)} />
    </Screen>
  );
}

export default premiumOnly(Vehicles, 'Vehicles', 'Fuel mileage, service, insurance and PUC reminders.');
