import { randomUUID } from 'expo-crypto';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { PinPad } from '../components/LockScreen';
import { premiumOnly } from '../components/PremiumGate';
import { toast } from '../components/Toast';
import { Button, Card, Chip, Field, Icon, ProgressBar, Row, Screen, SectionTitle, styles } from '../components/ui';
import { t } from '../i18n';
import { diffDays, formatDate } from '../logic/dates';
import type { VaultEntry } from '../logic/types';
import { allCategories, allGroups, looksSecret, readiness, vaultHtml, vaultRows, type VaultRow } from '../logic/vault';
import { shareLockedPdf } from '../services/vaultPdf';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

type Draft = { id?: string; section: string; linkedId?: string; title: string; holder: string; nominee: string; where: string; contact: string; value: string; detail: string; extra: Record<string, string> };
const emptyDraft = (section: string): Draft => ({ section, title: '', holder: '', nominee: '', where: '', contact: '', value: '', detail: '', extra: {} });

function Vault() {
  const data = useAppData();
  const { saveItem, deleteItem, updateSettings } = useStore();
  const { money } = useMoney();
  // The vault asks for the PIN again every time it is opened.
  const [unlocked, setUnlocked] = useState(!data.settings.lockEnabled);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sharing, setSharing] = useState(false);
  const [password, setPassword] = useState('');
  const [sendTo, setSendTo] = useState(data.settings.vaultShared?.with ?? '');
  const rows = useMemo(() => vaultRows(data), [data]);
  const ready = useMemo(() => readiness(data, rows), [data, rows]);
  const na = new Set(data.settings.vaultNA ?? []);
  const cats = allCategories(data);
  const groups = allGroups(cats);
  const custom = data.settings.vaultCustom ?? [];
  const [newTopic, setNewTopic] = useState('');
  const [newGroup, setNewGroup] = useState('');

  if (!unlocked) return <PinPad title={t('Unlock the money vault')} useBiometrics={!!data.settings.useBiometrics} onUnlock={() => setUnlocked(true)} />;

  const sharedDaysAgo = data.settings.vaultShared ? diffDays(new Date(), new Date(data.settings.vaultShared.at)) : null;
  const owner = data.members.find((m) => m.id === data.settings.currentMemberId)?.name ?? 'me';

  const edit = (r: VaultRow) => {
    const e = r.entry;
    setDraft({
      id: e?.id,
      section: r.section,
      linkedId: r.auto?.linkedId,
      title: e?.title ?? r.title,
      holder: e?.holder ?? '',
      nominee: e?.nominee ?? r.nominee ?? '',
      where: e?.where ?? '',
      contact: e?.contact ?? '',
      value: r.value ? String(r.value) : '',
      detail: e?.detail ?? '',
      extra: { ...r.extra },
    });
  };

  const save = (d: Draft, checked = false) => {
    if (!d.title.trim()) return ask('Add a name', 'For example “SBI savings” or “LIC term plan”.');
    if (!checked && [d.detail, d.where, d.contact, ...Object.values(d.extra)].some(looksSecret)) {
      return ask('This looks like a PIN, password or full card number', 'Never store those here. The family file is for where things are and who to call.', [
        { text: 'Edit', style: 'cancel' },
        { text: 'Save anyway', style: 'destructive', onPress: () => save(d, true) },
      ]);
    }
    const entry: Omit<VaultEntry, 'id'> & { id?: string } = {
      id: d.id,
      section: d.section,
      linkedId: d.linkedId,
      title: d.title.trim(),
      holder: d.holder.trim() || undefined,
      nominee: d.nominee.trim() || undefined,
      where: d.where.trim() || undefined,
      contact: d.contact.trim() || undefined,
      value: parseFloat(d.value) || undefined,
      detail: d.detail.trim(),
      extra: Object.fromEntries(Object.entries(d.extra).filter(([, v]) => v.trim())),
    };
    saveItem('vault', entry);
    setDraft(null);
  };

  const share = async () => {
    if (password.length < 6) return ask('Set a family password', 'Use at least 6 characters. Tell it to your family in person or by phone, never in the same message as the file.');
    try {
      const ok = await shareLockedPdf(vaultHtml(data, money, owner, new Date()), password);
      if (!ok) return ask('Works in the installed app', 'Password-locked PDFs are made on your phone. Open FamilyFin from Google Play to share.');
      updateSettings({ vaultShared: { at: new Date().toISOString(), with: sendTo.trim() || 'family' } });
      setSharing(false);
      setPassword('');
      toast('Family file shared. Tell them the password separately.');
    } catch (e) {
      ask('Could not create the file', `Please try again.\n\n(${(e as Error).message})`);
    }
  };

  const cat = draft ? cats.find((c) => c.key === draft.section) : undefined;

  const addTopic = () => {
    const label = newTopic.trim();
    const group = newGroup.trim() || 'My own topics';
    if (!label) return ask('Name the topic', 'For example “Chit fund”, “Business partnership” or “Kids’ savings”.');
    if (cats.some((c) => c.label.toLowerCase() === label.toLowerCase())) return ask('That topic already exists');
    const key = `custom-${randomUUID().slice(0, 8)}`;
    updateSettings({ vaultCustom: [...custom, { key, group, label }] });
    setNewTopic('');
    setOpen(key);
    toast(`Added “${label}” to ${group}`);
  };
  const deleteTopic = (key: string, label: string) =>
    ask(`Delete the topic “${label}”?`, 'Items you added to it move to “Anything else”.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => updateSettings({ vaultCustom: custom.filter((c) => c.key !== key) }) },
    ]);

  if (draft && cat) {
    const set = (k: keyof Draft, v: string) => setDraft({ ...draft, [k]: v });
    return (
      <Screen>
        <Row>
          <Icon name={cat.icon} color={colors.primary} />
          <Text style={[styles.sectionTitle, { flex: 1 }]}>{cat.label}</Text>
        </Row>
        {draft.linkedId ? <Text style={styles.hint}>From your FamilyFin data. Add what your family needs to know.</Text> : null}
        <Field label="Name / institution" value={draft.title} onChangeText={(v) => set('title', v)} placeholder={cat.hint} editable={!draft.linkedId} />
        {(cat.extra ?? []).map((x) => (
          <Field key={x.key} label={x.label} value={draft.extra[x.key] ?? ''} onChangeText={(v) => setDraft({ ...draft, extra: { ...draft.extra, [x.key]: v } })} placeholder={x.placeholder} />
        ))}
        <Field label="In whose name" value={draft.holder} onChangeText={(v) => set('holder', v)} placeholder="e.g. Me, joint with Priya" />
        {cat.nominee ? <Field label="Nominee" value={draft.nominee} onChangeText={(v) => set('nominee', v)} placeholder="e.g. Priya (wife)" /> : null}
        <Field label="Where to find it" value={draft.where} onChangeText={(v) => set('where', v)} placeholder="e.g. Blue file, bedroom cupboard · HDFC app" />
        <Field label="Contact" value={draft.contact} onChangeText={(v) => set('contact', v)} placeholder="Branch, agent or HR phone" />
        {!draft.linkedId ? <Field label="Approx. value" value={draft.value} onChangeText={(v) => set('value', v)} keyboardType="decimal-pad" /> : null}
        <Field label="Note" value={draft.detail} onChangeText={(v) => set('detail', v)} placeholder="Anything else they should know" multiline />
        <Text style={styles.hint}>Never write PINs, passwords, CVVs or full account numbers.</Text>
        <Button title="Save" icon="checkmark" onPress={() => save(draft)} />
        {draft.id ? (
          <Button
            title={draft.linkedId ? 'Remove my details' : 'Delete'}
            variant="danger"
            icon="trash-outline"
            onPress={() => {
              deleteItem('vault', draft.id!);
              setDraft(null);
            }}
          />
        ) : null}
        <Button title="Cancel" variant="secondary" onPress={() => setDraft(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      {!data.settings.lockEnabled ? (
        <Card style={{ backgroundColor: colors.warningSoft }}>
          <Text style={[styles.insightText, { color: colors.warning }]}>Turn on App lock (More → Security) so the vault needs your PIN to open.</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.itemTitle}>Your family file is {ready.percent}% ready</Text>
        <ProgressBar value={ready.percent / 100} color={colors.success} plain />
        <Text style={styles.hint}>
          {ready.done} of {ready.total} topics done. Tap a topic to add details, or mark it “I don’t have this”.
        </Text>
        {ready.missingNominee.length ? (
          <Text style={[styles.insightText, { color: colors.warning }]}>
            ⚠️ No nominee for: {ready.missingNominee.slice(0, 4).map((r) => r.title).join(', ')}
            {ready.missingNominee.length > 4 ? ` and ${ready.missingNominee.length - 4} more` : ''}
          </Text>
        ) : null}
        {sharedDaysAgo !== null && sharedDaysAgo >= 180 ? (
          <Text style={[styles.insightText, { color: colors.warning }]}>Your family file is {Math.floor(sharedDaysAgo / 30)} months old. Update and share again.</Text>
        ) : null}
        <Text style={styles.hint}>
          {data.settings.vaultShared ? `Last shared ${formatDate(data.settings.vaultShared.at.slice(0, 10))} with ${data.settings.vaultShared.with}.` : 'Not shared yet.'}
        </Text>
        {sharing ? (
          <View style={{ gap: 8 }}>
            <Field label="Family password (to open the PDF)" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" autoCapitalize="none" />
            <Field label="Sending to" value={sendTo} onChangeText={setSendTo} placeholder="e.g. Priya (wife)" />
            <Text style={styles.hint}>Tell the password in person or by phone. Never send it in the same message as the file.</Text>
            <Button title="Create locked PDF & share" icon="lock-closed-outline" onPress={share} />
            <Button title="Cancel" variant="secondary" onPress={() => setSharing(false)} />
          </View>
        ) : (
          <Button title="Share with my family" icon="share-outline" onPress={() => setSharing(true)} />
        )}
      </Card>

      {groups.map((g) => (
        <View key={g} style={{ gap: 8 }}>
          <SectionTitle title={g} />
          {cats.filter((c) => c.group === g).map((c) => {
            const items = rows.filter((r) => r.section === c.key);
            const isNA = na.has(c.key);
            const expanded = open === c.key;
            return (
              <Card key={c.key} style={{ padding: 12, gap: 6 }}>
                <Pressable onPress={() => setOpen(expanded ? null : c.key)} accessibilityRole="button" accessibilityState={{ expanded }}>
                  <Row>
                    <Icon name={c.icon} color={items.length ? colors.success : isNA ? colors.muted : colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{c.label}</Text>
                      <Text style={styles.itemSub}>{items.length ? `${items.length} added` : isNA ? 'I don’t have this' : c.hint}</Text>
                    </View>
                    <Icon name={items.length || isNA ? 'checkmark-circle' : expanded ? 'chevron-up' : 'chevron-down'} color={items.length || isNA ? colors.success : colors.muted} />
                  </Row>
                </Pressable>
                {expanded ? (
                  <View style={{ gap: 6 }}>
                    {items.map((r) => (
                      <Pressable key={r.key} onPress={() => edit(r)} accessibilityRole="button" style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 2 }}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Text style={[styles.itemTitle, { flex: 1 }]}>{r.title}</Text>
                          {r.value ? <Text style={styles.itemSub}>{money(r.value)}</Text> : null}
                        </Row>
                        <Text style={styles.itemSub}>
                          {[r.auto ? 'From your app' : null, r.nominee ? `Nominee: ${r.nominee}` : c.nominee ? '⚠️ No nominee' : null, r.entry?.where ? `📍 ${r.entry.where}` : null].filter(Boolean).join(' · ') || 'Tap to add details'}
                        </Text>
                      </Pressable>
                    ))}
                    <Row style={{ flexWrap: 'wrap' }}>
                      <Chip label="Add" icon="add" onPress={() => setDraft(emptyDraft(c.key))} />
                      {c.key.startsWith('custom-') ? <Chip label="Delete topic" icon="trash-outline" onPress={() => deleteTopic(c.key, c.label)} /> : null}
                      {!items.length && !c.key.startsWith('custom-') ? (
                        <Chip
                          label={isNA ? 'I have this' : 'I don’t have this'}
                          icon={isNA ? 'arrow-undo-outline' : 'remove-circle-outline'}
                          onPress={() => updateSettings({ vaultNA: isNA ? [...na].filter((k) => k !== c.key) : [...na, c.key] })}
                        />
                      ) : null}
                    </Row>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ))}
      <SectionTitle title="Add your own topic" />
      <Card style={{ gap: 8 }}>
        <Text style={styles.itemSub}>Something that isn’t listed? Add it. For example a chit fund, a business share, kids’ savings or a property abroad.</Text>
        <Field label="Topic name" value={newTopic} onChangeText={setNewTopic} placeholder="e.g. Chit fund" />
        <Text style={styles.label}>Group</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {[...new Set([...groups, 'My own topics'])].map((g) => (
            <Chip key={g} label={g} selected={(newGroup.trim() || 'My own topics') === g} onPress={() => setNewGroup(g)} />
          ))}
        </Row>
        <Field label="…or a new group" value={groups.includes(newGroup) || newGroup === 'My own topics' ? '' : newGroup} onChangeText={setNewGroup} placeholder="e.g. Business" />
        <Button title="Add topic" icon="add" onPress={addTopic} />
      </Card>
      <Text style={[styles.hint, { textAlign: 'center' }]}>Never store PINs, passwords or full card numbers. Account numbers: last 4 digits only.</Text>
    </Screen>
  );
}

export default premiumOnly(Vault, 'Money Vault', 'Everything your family should know (accounts, lockers, insurance, PF, property, who to call) in one password-locked file you can share.');
