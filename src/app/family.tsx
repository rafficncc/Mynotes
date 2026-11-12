import { ask } from '../components/Dialog';
import { useMemo, useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Field, Icon, ProgressBar, Row, Screen, SectionTitle, styles } from '../components/ui';
import { expenses, inMonth } from '../logic/analytics';
import { formatDate, toISODate } from '../logic/dates';
import { makeInvite, makeUpdate, newGroupCode, parseInvite, parseUpdate } from '../logic/familySync';
import { uid } from '../logic/money';
import { useAppData, useCycle, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Family() {
  const data = useAppData();
  const cycle = useCycle();
  const { addMember, updateMember, deleteMember, setGroup, importFamilySpends, updateSettings } = useStore();
  const { money } = useMoney();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [budget, setBudget] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [paste, setPaste] = useState('');

  const spent = useMemo(() => {
    const txns = expenses(inMonth(data.transactions, cycle.key, cycle.startDay));
    const map = new Map<string, number>();
    for (const t of txns) map.set(t.memberId ?? '_family', (map.get(t.memberId ?? '_family') ?? 0) + t.amount);
    return map;
  }, [data.transactions, cycle.key, cycle.startDay]);
  const allowanceTotal = data.members.reduce((s, m) => s + (m.budget ?? 0), 0);
  const me = data.members.find((m) => m.id === data.settings.currentMemberId);

  const edit = (id: string) => {
    const m = data.members.find((x) => x.id === id)!;
    setEditing(id);
    setName(m.name);
    setRelation(m.relation);
    setBudget(m.budget ? String(m.budget) : '');
  };
  const reset = () => {
    setEditing(null);
    setName('');
    setRelation('');
    setBudget('');
  };
  const save = () => {
    if (!name.trim()) return ask('Enter a name');
    const patch = { name: name.trim(), relation: relation.trim() || 'Family', budget: parseFloat(budget) || undefined };
    if (editing) updateMember(editing, patch);
    else addMember(patch);
    reset();
  };

  const share = async (message: string) => {
    try {
      await Share.share({ message });
    } catch {
      ask('Could not open the share sheet');
    }
  };

  const createGroup = () => {
    const g = { id: uid(), name: groupName.trim() || 'Our family', code: newGroupCode(), isAdmin: true };
    setGroup(g);
    setGroupName('');
  };

  const handlePaste = () => {
    const text = paste.trim();
    if (!text) return;
    try {
      if (text.startsWith('FFI1:')) {
        const inv = parseInvite(text);
        setGroup(inv.group, inv.members);
        ask(`Joined ${inv.group.name}`, 'Now choose who you are under “This phone is used by”.');
      } else {
        const upd = parseUpdate(text, data);
        const added = importFamilySpends(upd.transactions);
        const who = data.members.find((m) => m.id === upd.memberId)?.name ?? 'Member';
        ask('Update imported', `${added} new spend${added === 1 ? '' : 's'} from ${who}.`);
      }
      setPaste('');
    } catch (e) {
      ask('Could not read the code', (e as Error).message);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.itemTitle}>Allowances this cycle · {cycle.label}</Text>
        {allowanceTotal > 0 ? <Text style={styles.itemSub}>{money(allowanceTotal)} allocated across the family</Text> : <Text style={styles.itemSub}>Give each member a spending allowance. Tap a member to set it.</Text>}
        {data.members.map((m) => {
          const used = spent.get(m.id) ?? 0;
          return (
            <View key={m.id} style={{ gap: 4, paddingVertical: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.itemTitle} onPress={() => edit(m.id)}>
                  {m.name} <Text style={styles.itemSub}>· {m.relation}{data.settings.currentMemberId === m.id ? ' · this phone' : ''}</Text>
                </Text>
                <Text style={styles.insightText}>
                  {money(used)}{m.budget ? ` / ${money(m.budget)}` : ''}
                </Text>
              </Row>
              {m.budget ? <ProgressBar value={used / m.budget} /> : null}
              {m.budget ? (
                <Text style={[styles.hint, used > m.budget && { color: colors.danger }]}>
                  {used > m.budget ? `${money(used - m.budget)} over allowance` : `${money(m.budget - used)} left`}
                </Text>
              ) : null}
            </View>
          );
        })}
        {(spent.get('_family') ?? 0) > 0 ? <Text style={styles.itemSub}>Shared family spends: {money(spent.get('_family') ?? 0)}</Text> : null}
      </Card>

      <SectionTitle title={editing ? 'Edit member' : 'Add member'} />
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Name" value={name} onChangeText={setName} placeholder="Name" /></View>
          <View style={{ flex: 1 }}><Field label="Relation" value={relation} onChangeText={setRelation} placeholder="Spouse, Son…" /></View>
        </Row>
        <Field label="Allowance per cycle (optional)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="e.g. 5000" />
        <Button title={editing ? 'Save member' : 'Add member'} icon="person-add-outline" onPress={save} />
        {editing ? (
          <ChipRow>
            <Chip label="This phone is theirs" icon="phone-portrait-outline" onPress={() => { updateSettings({ currentMemberId: editing }); reset(); }} />
            <Chip label="Cancel" onPress={reset} />
            {editing !== 'me' ? (
              <Chip
                label="Remove"
                icon="trash-outline"
                onPress={() =>
                  ask('Remove member?', 'Past spends stay, shown as “Whole family”.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => { deleteMember(editing); reset(); } },
                  ])
                }
              />
            ) : null}
          </ChipRow>
        ) : null}
      </Card>

      <SectionTitle title="Family group" />
      <Card>
        {!data.group ? (
          <>
            <Text style={styles.itemSub}>
              Create a group so each member can log spends on their own phone against their allowance. Members send you an update code; you import it here.
            </Text>
            <Field label="Group name" value={groupName} onChangeText={setGroupName} placeholder="e.g. Sharma family" />
            <Button title="Create family group" icon="people-outline" onPress={createGroup} />
          </>
        ) : (
          <>
            <Row>
              <Icon name="people" color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{data.group.name}</Text>
                <Text style={styles.itemSub}>
                  Code {data.group.code} · {data.group.isAdmin ? 'you organise this group' : 'member'}
                  {data.group.lastSync ? ` · last import ${formatDate(toISODate(new Date(data.group.lastSync)))}` : ''}
                </Text>
              </View>
            </Row>
            {data.group.isAdmin ? (
              <Button title="Invite family members" icon="share-social-outline" onPress={() => share(`Join our family budget on FamilyFin.\nOpen More → Family & allowances → paste this code:\n\n${makeInvite(data.group!, data.members)}`)} />
            ) : null}
            <Button
              title={me ? `Send ${me.name}'s spends to the organiser` : 'Choose who uses this phone first'}
              variant="secondary"
              icon="paper-plane-outline"
              disabled={!me}
              onPress={() => share(`FamilyFin update from ${me!.name}:\n\n${makeUpdate(data, me!.id)}`)}
            />
            <Button title="Leave group" variant="danger" icon="exit-outline" onPress={() => setGroup(undefined)} />
          </>
        )}
        <Text style={styles.label}>Paste an invite or update code</Text>
        <TextInput value={paste} onChangeText={setPaste} placeholder="FFI1:… or FFU1:…" placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 70 }]} multiline />
        <Button title="Import code" variant="secondary" icon="download-outline" onPress={handlePaste} disabled={!paste.trim()} />
        <Text style={styles.hint}>Codes only contain the spends of that member. Importing the same code twice adds nothing new.</Text>
      </Card>
    </Screen>
  );
}
