import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { HBars } from '../components/charts';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { formatDate, toISODate } from '../logic/dates';
import type { ClaimStatus, MedicalClaim } from '../logic/types';
import { defaultPayAccount } from '../logic/payments';
import { notifyBalance, useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const STATUS: { key: ClaimStatus; label: string; color: string }[] = [
  { key: 'to_submit', label: 'To submit', color: colors.warning },
  { key: 'submitted', label: 'Submitted', color: colors.info },
  { key: 'approved', label: 'Approved', color: colors.primary },
  { key: 'paid', label: 'Paid', color: colors.success },
  { key: 'rejected', label: 'Rejected', color: colors.danger },
];

export default function Claims() {
  const data = useAppData();
  const { saveItem, deleteItem, addTransaction, deleteTransaction, updateTransaction } = useStore();
  const { money } = useMoney();
  const blank = { title: '', memberId: '', policyId: '', amount: '', date: toISODate(new Date()), status: 'to_submit' as ClaimStatus, approvedAmount: '', notes: '' };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const set = (patch: Partial<typeof blank>) => setF((x) => ({ ...x, ...patch }));
  const year = new Date().getFullYear().toString();

  // Medical spend this year, per family member (Health category)
  const byMember = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data.transactions) {
      if (t.type !== 'expense' || t.categoryId !== 'health' || !t.date.startsWith(year)) continue;
      const k = t.memberId ?? '_family';
      m.set(k, (m.get(k) ?? 0) + t.amount);
    }
    return [...m.entries()].map(([id, value]) => ({ label: data.members.find((x) => x.id === id)?.name ?? 'Whole family', value }));
  }, [data.transactions, data.members, year]);

  const pending = data.claims.filter((c) => c.status === 'to_submit' || c.status === 'submitted' || c.status === 'approved').reduce((s, c) => s + (c.approvedAmount ?? c.amount), 0);
  const received = data.claims.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.approvedAmount ?? c.amount), 0);

  const edit = (c: MedicalClaim) => {
    setEditing(c.id);
    setF({ title: c.title, memberId: c.memberId ?? '', policyId: c.policyId ?? '', amount: String(c.amount), date: c.date, status: c.status, approvedAmount: c.approvedAmount ? String(c.approvedAmount) : '', notes: c.notes ?? '' });
  };
  const save = () => {
    const amount = parseFloat(f.amount);
    if (!f.title.trim() || !amount) return ask('Enter what the claim is for and the amount');
    const old = data.claims.find((c) => c.id === editing);
    const payout = parseFloat(f.approvedAmount) || amount;
    let paidTxnId = old?.paidTxnId;
    if (f.status === 'paid' && !paidTxnId) {
      const accountId = defaultPayAccount(data.accounts);
      if (accountId) {
        paidTxnId = addTransaction({ type: 'income', amount: payout, date: toISODate(new Date()), accountId, categoryId: 'other_income', merchant: 'Insurance claim', note: f.title.trim(), memberId: f.memberId || undefined });
        setTimeout(() => notifyBalance(accountId, 'Claim money received'), 0);
      }
    } else if (f.status !== 'paid' && paidTxnId) {
      deleteTransaction(paidTxnId); // claim no longer paid: undo the income (kept in the recycle bin)
      paidTxnId = undefined;
    } else if (f.status === 'paid' && paidTxnId && old && (old.approvedAmount ?? old.amount) !== payout) {
      updateTransaction(paidTxnId, { amount: payout });
    }
    saveItem('claims', {
      paidTxnId,
      id: editing ?? undefined,
      title: f.title.trim(),
      memberId: f.memberId || undefined,
      policyId: f.policyId || undefined,
      amount,
      date: f.date,
      status: f.status,
      submittedOn: f.status === 'to_submit' ? undefined : old?.submittedOn ?? toISODate(new Date()),
      approvedAmount: parseFloat(f.approvedAmount) || undefined,
      notes: f.notes.trim() || undefined,
    });
    setEditing(null);
    setF(blank);
  };

  return (
    <Screen>
      <Card>
        <Row>
          <Stat label="Claims pending" value={money(pending)} color={colors.warning} />
          <Stat label="Received" value={money(received)} color={colors.success} />
        </Row>
      </Card>
      {byMember.length ? (
        <Card>
          <Text style={styles.itemTitle}>Medical spend in {year}</Text>
          <HBars rows={byMember} format={money} />
        </Card>
      ) : null}

      {data.claims.length ? <SectionTitle title="Claims" /> : null}
      {data.claims.length ? (
        <Card>
          {[...data.claims].sort((a, b) => b.date.localeCompare(a.date)).map((c) => {
            const st = STATUS.find((x) => x.key === c.status)!;
            return (
              <ListItem
                key={c.id}
                icon="medkit-outline"
                iconColor={st.color}
                title={`${c.title}${c.memberId ? ` · ${data.members.find((m) => m.id === c.memberId)?.name ?? ''}` : ''}`}
                subtitle={`${st.label} · treatment ${formatDate(c.date)}${c.policyId ? ` · ${data.policies.find((p) => p.id === c.policyId)?.name ?? ''}` : ''}`}
                right={money(c.approvedAmount ?? c.amount)}
                rightColor={st.color}
                onPress={() => edit(c)}
              />
            );
          })}
        </Card>
      ) : null}

      <SectionTitle title={editing ? 'Update claim' : 'New claim'} />
      <Card>
        <Field label="What for" value={f.title} onChangeText={(v) => set({ title: v })} placeholder="e.g. Hospital stay, dental treatment" />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Claimed amount" value={f.amount} onChangeText={(v) => set({ amount: v })} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Approved amount" value={f.approvedAmount} onChangeText={(v) => set({ approvedAmount: v })} keyboardType="decimal-pad" /></View>
        </Row>
        <DateField label="Treatment date" value={f.date} onChange={(v) => set({ date: v })} />
        <Text style={styles.label}>Status</Text>
        <ChipRow>
          {STATUS.map((s) => (
            <Chip key={s.key} label={s.label} color={s.color} selected={f.status === s.key} onPress={() => set({ status: s.key })} />
          ))}
        </ChipRow>
        <Text style={styles.label}>Patient</Text>
        <ChipRow>
          {data.members.map((m) => (
            <Chip key={m.id} label={m.name} selected={f.memberId === m.id} onPress={() => set({ memberId: m.id })} />
          ))}
        </ChipRow>
        {data.policies.length ? (
          <>
            <Text style={styles.label}>Policy</Text>
            <ChipRow>
              {data.policies.map((p) => (
                <Chip key={p.id} label={p.name} selected={f.policyId === p.id} onPress={() => set({ policyId: p.id })} />
              ))}
            </ChipRow>
          </>
        ) : null}
        <Field label="Notes" value={f.notes} onChangeText={(v) => set({ notes: v })} placeholder="Claim no., documents still needed…" />
        <Button title={editing ? 'Save claim' : 'Add claim'} icon="checkmark" onPress={save} />
        {editing ? <Button title="Delete claim" variant="danger" icon="trash-outline" onPress={() => { deleteItem('claims', editing); setEditing(null); setF(blank); }} /> : null}
      </Card>
    </Screen>
  );
}
