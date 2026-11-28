import { ask } from '../components/Dialog';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GradientBg } from '../components/GradientBg';
import { DateField } from '../components/DateField';
import { Button, Card, Chip, ChipRow, Field, Icon, Row, Screen, SectionTitle, styles, HeaderAdd } from '../components/ui';
import { DOCUMENT_TYPES, documentTypeInfo } from '../logic/actions';
import { diffDays, parseDate } from '../logic/dates';
import type { DocumentRecord, DocumentType } from '../logic/types';
import { useAppData } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors, isDark } from '../theme';

const REMIND = [7, 15, 30, 60, 90, 180];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

type DocStatus = 'expired' | 'soon' | 'valid' | 'none';
// Same colours as the Actions tab (dark → light gradient per status).
const STATUS: { key: DocStatus; title: string; short: string; icon: string; dark: string; light: string }[] = [
  { key: 'expired', title: 'Expired', short: 'Expired', icon: 'alert-circle', dark: '#C8324A', light: '#FF9E8A' },
  { key: 'soon', title: 'Renew soon', short: 'Renew soon', icon: 'time', dark: '#D9861A', light: '#FFD978' },
  { key: 'valid', title: 'Valid', short: 'Valid', icon: 'checkmark-done', dark: '#0B6E4F', light: '#7EE3B5' },
  { key: 'none', title: 'No expiry date', short: 'No date', icon: 'help-circle', dark: '#2F5FC4', light: '#9CC3FF' },
];

export default function Documents() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const data = useAppData();
  const { saveDocument, deleteDocument } = useStore();
  const on = new Date();

  // Opened from the Actions tab with ?edit=<id> → start in edit mode for that document.
  const initial = data.documents.find((x) => x.id === params.edit);
  const [editing, setEditing] = useState<string | null>(initial?.id ?? null);
  const [adding, setAdding] = useState(false);
  const formOpen = adding || !!editing;
  const navigation = useNavigation();
  useEffect(() => navigation.setOptions({ headerRight: formOpen ? undefined : () => <HeaderAdd label="Add a document" onPress={() => setAdding(true)} /> }), [navigation, formOpen]);
  const close = () => reset();
  const [type, setType] = useState<DocumentType>(initial?.type ?? 'passport');
  const [name, setName] = useState(initial?.name ?? '');
  const [memberId, setMemberId] = useState(initial?.memberId ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [expiry, setExpiry] = useState(initial?.expiryDate ?? '');
  const [remind, setRemind] = useState(initial?.remindDaysBefore ?? 180);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [filter, setFilter] = useState<DocStatus | null>(null);

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
    setAdding(false);
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

  const statusOf = (d: DocumentRecord): DocStatus => {
    if (!d.expiryDate) return 'none';
    const days = diffDays(parseDate(d.expiryDate), on);
    return days < 0 ? 'expired' : days <= d.remindDaysBefore ? 'soon' : 'valid';
  };
  const count = (k: DocStatus) => sorted.filter((d) => statusOf(d) === k).length;
  const sel = STATUS.find((x) => x.key === filter);

  if (formOpen) {
    return (
      <Screen>
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
          <Button title="Cancel" variant="secondary" onPress={close} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Summary: tap a tile to show only that group */}
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <GradientBg id="docbg" />
        <View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff10', top: -80, right: -60 }} />
        <View style={{ padding: 16, gap: 12 }}>
          <View>
            <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Family documents</Text>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{sorted.length} tracked</Text>
            <Text style={{ color: count('expired') + count('soon') ? '#FFD978' : '#7EE3B5', fontSize: 13, fontWeight: '700' }}>
              {count('expired') + count('soon') ? `${count('expired') + count('soon')} need attention` : 'All up to date'}
            </Text>
          </View>
          <Row style={{ gap: 8 }}>
            {STATUS.map((x) => {
              const on2 = filter === x.key;
              return (
                <Pressable
                  key={x.key}
                  onPress={() => setFilter(on2 ? null : x.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on2 }}
                  accessibilityLabel={`${x.short}: ${count(x.key)}`}
                  style={{ flex: 1, backgroundColor: on2 ? '#fff' : '#ffffff1a', borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: on2 ? x.light : '#ffffff26' }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on2 ? '#1B1F5E' : x.light + '33' }}>
                    <Icon name={x.icon} size={15} color={x.light} />
                  </View>
                  <Text style={{ color: on2 ? '#1B1F5E' : x.light, fontSize: 22, fontWeight: '900' }}>{count(x.key)}</Text>
                  <Text style={{ color: on2 ? '#1B1F5E' : '#ffffffd9', fontSize: 11, fontWeight: '700' }}>{x.short}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
      </View>

      {sel ? (
        <Pressable onPress={() => setFilter(null)} accessibilityRole="button" style={{ borderRadius: 14, overflow: 'hidden' }}>
          <GradientBg id="docfilter" />
          <Row style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sel.light }} />
            <Text style={{ flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 }}>
              Showing only <Text style={{ color: sel.light, fontWeight: '900' }}>{sel.short}</Text>
            </Text>
            <View style={{ backgroundColor: '#ffffff26', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Clear ✕</Text>
            </View>
          </Row>
        </Pressable>
      ) : null}

      {sorted.length === 0 ? (
        <Card>
          <Text style={styles.itemSub}>Track passports, visas, Emirates ID, driving licences and more. FamilyFin reminds you well before they expire.</Text>
        </Card>
      ) : null}

      {STATUS.filter((x) => !filter || x.key === filter).map((sec) => {
        const items = sorted.filter((d) => statusOf(d) === sec.key);
        if (!items.length) return null;
        return (
          <View key={sec.key} style={{ gap: 10 }}>
            <Row style={{ gap: 8, marginTop: 6 }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: sec.light }} />
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted, flex: 1 }}>{sec.title.toUpperCase()}</Text>
              <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>
                {items.length} document{items.length === 1 ? '' : 's'}
              </Text>
            </Row>
            {items.map((d) => {
              const info = documentTypeInfo(d.type);
              const member = data.members.find((m) => m.id === d.memberId)?.name;
              const date = d.expiryDate ? parseDate(d.expiryDate) : null;
              const days = date ? diffDays(date, on) : null;
              const chip = days === null ? 'No expiry date' : days < 0 ? `Expired ${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'Expires today' : days < 60 ? `${days} day${days === 1 ? '' : 's'} left` : `${Math.round(days / 30)} months left`;
              return (
                <Pressable key={d.id} onPress={() => edit(d)} accessibilityRole="button" accessibilityLabel={`${d.name}, ${chip}. Edit`} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: editing === d.id ? sec.dark : colors.border }}>
                  <Row style={{ gap: 12 }}>
                    {/* Calendar-style expiry date in the status colour */}
                    <View style={{ width: 56, height: 62, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                      <GradientBg id={`dg${d.id.replace(/[^a-zA-Z0-9]/g, '')}`} colors={[sec.dark, sec.light]} />
                      {date ? (
                        <>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{MONTHS[date.getMonth()]}</Text>
                          <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', lineHeight: 24 }}>{date.getDate()}</Text>
                          <Text style={{ color: '#ffffffd9', fontSize: 10, fontWeight: '700' }}>{date.getFullYear()}</Text>
                        </>
                      ) : (
                        <Icon name={info.icon} size={24} color="#fff" />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Row style={{ gap: 6 }}>
                        <Icon name={info.icon} color={sec.dark} size={15} />
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                          {d.name}
                        </Text>
                      </Row>
                      <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                        {[member, d.number, d.notes].filter(Boolean).join(' · ') || info.label}
                      </Text>
                      <Row style={{ gap: 8 }}>
                        <View style={{ backgroundColor: sec.light + '33', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: isDark ? sec.light : sec.dark, fontSize: 11, fontWeight: '800' }}>{chip}</Text>
                        </View>
                        <Text style={{ marginLeft: 'auto', color: colors.primary, fontSize: 12, fontWeight: '800' }}>Edit ›</Text>
                      </Row>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </View>
        );
      })}

      <Button title="Add a document" icon="add" onPress={() => setAdding(true)} />
    </Screen>
  );
}
