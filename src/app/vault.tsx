import { useState } from 'react';
import { t } from '../i18n';
import { Share, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { PinPad } from '../components/LockScreen';
import { Button, Card, Chip, ChipRow, Field, ListItem, Screen, SectionTitle, styles } from '../components/ui';
import type { VaultEntry, VaultSection } from '../logic/types';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const SECTIONS: { key: VaultSection; label: string; icon: string; hint: string }[] = [
  { key: 'instruction', label: 'If something happens to me', icon: 'heart-outline', hint: 'What to do first, who to call, where papers are kept' },
  { key: 'contact', label: 'Emergency contacts', icon: 'call-outline', hint: 'Name, relation and phone' },
  { key: 'nominee', label: 'Nominees', icon: 'people-outline', hint: 'Who is nominee for which account or policy' },
  { key: 'account', label: 'Accounts & where to find them', icon: 'business-outline', hint: 'Bank, branch, locker, PF, investments – no passwords' },
  { key: 'other', label: 'Other', icon: 'folder-outline', hint: 'Anything else the family should know' },
];

export default function Vault() {
  const data = useAppData();
  const { saveItem, deleteItem } = useStore();
  const { money } = useMoney();
  // The vault asks for the PIN again every time it is opened.
  const [unlocked, setUnlocked] = useState(!data.settings.lockEnabled);
  const [section, setSection] = useState<VaultSection>('instruction');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  if (!unlocked) return <PinPad title={t('Unlock the money vault')} useBiometrics={!!data.settings.useBiometrics} onUnlock={() => setUnlocked(true)} />;

  const save = () => {
    if (!title.trim()) return ask('Add a title');
    saveItem('vault', { id: editing ?? undefined, section, title: title.trim(), detail: detail.trim() });
    setEditing(null);
    setTitle('');
    setDetail('');
  };
  const edit = (e: VaultEntry) => {
    setEditing(e.id);
    setSection(e.section);
    setTitle(e.title);
    setDetail(e.detail);
  };

  const policyLines = data.policies.map((p) => `${p.name}${p.insurer ? ` (${p.insurer}${p.policyNo ? `, ${p.policyNo}` : ''})` : ''}${p.sumAssured ? ` – cover ${money(p.sumAssured)}` : ''}${p.nominee ? ` – nominee ${p.nominee}` : ''}`);

  const shareAll = async () => {
    const text = [
      'FAMILY MONEY VAULT (keep private)',
      ...SECTIONS.flatMap((s) => {
        const items = data.vault.filter((e) => e.section === s.key);
        return items.length ? [`\n${s.label.toUpperCase()}`, ...items.map((e) => `• ${e.title}${e.detail ? `: ${e.detail}` : ''}`)] : [];
      }),
      ...(policyLines.length ? ['\nINSURANCE POLICIES', ...policyLines.map((l) => `• ${l}`)] : []),
    ].join('\n');
    try {
      await Share.share({ message: text });
    } catch {
      ask('Could not open the share sheet');
    }
  };

  return (
    <Screen>
      {!data.settings.lockEnabled ? (
        <Card style={{ backgroundColor: colors.warningSoft }}>
          <Text style={[styles.insightText, { color: colors.warning }]}>Turn on App lock (More → Security) so the vault needs your PIN to open.</Text>
        </Card>
      ) : null}
      <Text style={styles.itemSub}>Information your family needs if the earning member can’t help. Never store passwords or PINs here.</Text>
      {SECTIONS.map((s) => {
        const items = data.vault.filter((e) => e.section === s.key);
        return (
          <Card key={s.key}>
            <Text style={styles.itemTitle}>{s.label}</Text>
            {items.length === 0 ? <Text style={styles.hint}>{s.hint}</Text> : null}
            {items.map((e) => (
              <ListItem key={e.id} icon={s.icon} title={e.title} subtitle={e.detail} onPress={() => edit(e)} />
            ))}
          </Card>
        );
      })}
      {policyLines.length ? (
        <Card>
          <Text style={styles.itemTitle}>Insurance policies (from Policies)</Text>
          {policyLines.map((l) => (
            <Text key={l} style={styles.itemSub}>• {l}</Text>
          ))}
        </Card>
      ) : null}

      <SectionTitle title={editing ? 'Edit entry' : 'Add to vault'} />
      <Card>
        <ChipRow>
          {SECTIONS.map((s) => (
            <Chip key={s.key} label={s.label} icon={s.icon} selected={section === s.key} onPress={() => setSection(s.key)} />
          ))}
        </ChipRow>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder={section === 'contact' ? 'e.g. Rajesh (brother)' : 'e.g. Bank locker'} />
        <Field label="Details" value={detail} onChangeText={setDetail} placeholder={SECTIONS.find((s) => s.key === section)!.hint} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} />
        <Button title={editing ? 'Save' : 'Add'} icon="checkmark" onPress={save} />
        {editing ? <Button title={t('Delete')} variant="danger" icon="trash-outline" onPress={() => { deleteItem('vault', editing); setEditing(null); setTitle(''); setDetail(''); }} /> : null}
      </Card>
      <View>
        <Button title="Share vault with spouse" variant="secondary" icon="share-outline" onPress={shareAll} />
      </View>
    </Screen>
  );
}
