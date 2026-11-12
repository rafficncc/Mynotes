import { ask } from '../components/Dialog';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { Button, Card, Chip, ChipRow, Field, ListItem, Screen, SectionTitle, styles } from '../components/ui';
import { DOCUMENT_TYPES, documentTypeInfo } from '../logic/actions';
import { diffDays, formatDate, parseDate } from '../logic/dates';
import type { DocumentRecord, DocumentType } from '../logic/types';
import { useAppData } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const REMIND = [7, 15, 30, 60, 90, 180];

export default function Documents() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const data = useAppData();
  const { saveDocument, deleteDocument } = useStore();
  const on = new Date();

  // Opened from the Actions tab with ?edit=<id> → start in edit mode for that document.
  const initial = data.documents.find((x) => x.id === params.edit);
  const [editing, setEditing] = useState<string | null>(initial?.id ?? null);
  const [type, setType] = useState<DocumentType>(initial?.type ?? 'passport');
  const [name, setName] = useState(initial?.name ?? '');
  const [memberId, setMemberId] = useState(initial?.memberId ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [expiry, setExpiry] = useState(initial?.expiryDate ?? '');
  const [remind, setRemind] = useState(initial?.remindDaysBefore ?? 180);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const edit = (d: DocumentRecord) => {
    setEditing(d.id);
    setType(d.type);
    setName(d.name);
    setMemberId(d.memberId ?? '');
    setNumber(d.number ?? '');
    setExpiry(d.expiryDate ?? '');
    setRemind(d.remindDaysBefore);
    setNotes(d.notes ?? '');
  };

  const reset = () => {
    setEditing(null);
    setName('');
    setNumber('');
    setExpiry('');
    setNotes('');
  };

  const pickType = (t: DocumentType) => {
    setType(t);
    setRemind(documentTypeInfo(t).remind);
  };

  const save = () => {
    saveDocument({
      id: editing ?? undefined,
      type,
      name: name.trim() || documentTypeInfo(type).label,
      memberId: memberId || undefined,
      number: number.trim() || undefined,
      expiryDate: expiry || undefined,
      remindDaysBefore: remind,
      notes: notes.trim() || undefined,
    });
    reset();
  };

  const sorted = useMemo(
    () => [...data.documents].sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999')),
    [data.documents],
  );

  return (
    <Screen>
      <Card>
        {sorted.length === 0 ? <Text style={styles.itemSub}>Track passports, visas, Emirates ID, driving licences and more. FamilyFin reminds you well before they expire.</Text> : null}
        {sorted.map((d) => {
          const info = documentTypeInfo(d.type);
          const member = data.members.find((m) => m.id === d.memberId)?.name;
          const days = d.expiryDate ? diffDays(parseDate(d.expiryDate), on) : null;
          const color = days === null ? colors.muted : days < 0 ? colors.danger : days <= d.remindDaysBefore ? colors.warning : colors.success;
          return (
            <ListItem
              key={d.id}
              icon={info.icon}
              iconColor={color}
              title={`${d.name}${member ? ` · ${member}` : ''}`}
              subtitle={[d.number, d.expiryDate ? `Expires ${formatDate(d.expiryDate)}` : 'No expiry date', d.notes].filter(Boolean).join(' · ')}
              right={days === null ? '' : days < 0 ? 'Expired' : `${days} days`}
              rightColor={color}
              onPress={() => edit(d)}
            />
          );
        })}
      </Card>

      <SectionTitle title={editing ? 'Edit document' : 'Add a document'} />
      <Card>
        <ChipRow>
          {DOCUMENT_TYPES.map((t) => (
            <Chip key={t.key} label={t.label} icon={t.icon} selected={type === t.key} onPress={() => pickType(t.key)} />
          ))}
        </ChipRow>
        <Field label="Name" value={name} onChangeText={setName} placeholder={documentTypeInfo(type).label} />
        <Text style={styles.label}>Belongs to</Text>
        <ChipRow>
          <Chip label="Not set" selected={!memberId} onPress={() => setMemberId('')} />
          {data.members.map((m) => (
            <Chip key={m.id} label={m.name} icon="person-outline" selected={memberId === m.id} onPress={() => setMemberId(m.id)} />
          ))}
        </ChipRow>
        <Field label="Document number (optional)" value={number} onChangeText={setNumber} placeholder="Stored only on this phone" />
        <DateField label="Expiry date" value={expiry} onChange={setExpiry} optional quick={false} />
        <Text style={styles.label}>Remind me before expiry</Text>
        <ChipRow>
          {REMIND.map((d) => (
            <Chip key={d} label={d >= 30 ? `${d / 30} month${d === 30 ? '' : 's'}` : `${d} days`} selected={remind === d} onPress={() => setRemind(d)} />
          ))}
        </ChipRow>
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="e.g. renewal centre, documents needed" />
        <Button title={editing ? 'Save document' : 'Add document'} icon="checkmark" onPress={save} />
        {editing ? (
          <View style={{ gap: 8 }}>
            <Button title="Cancel" variant="secondary" onPress={reset} />
            <Button
              title="Delete document"
              variant="danger"
              icon="trash-outline"
              onPress={() =>
                ask('Delete this document?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { deleteDocument(editing); reset(); } },
                ])
              }
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
