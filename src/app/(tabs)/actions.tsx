import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip, ChipRow, Empty, Icon, Row, Screen, SectionTitle, styles } from '../../components/ui';
import { generateActions, type ActionItem, type ActionStatus } from '../../logic/actions';
import { diffDays, formatShortDate, toISODate } from '../../logic/dates';
import { useAppData, useCycle, useMoney } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme';

const SECTIONS: { key: ActionStatus; title: string; color: string; bg: string }[] = [
  { key: 'overdue', title: 'Overdue', color: colors.danger, bg: colors.dangerSoft },
  { key: 'due', title: 'Due soon (reminder reached)', color: colors.warning, bg: colors.warningSoft },
  { key: 'upcoming', title: 'Later this cycle', color: colors.info, bg: colors.infoSoft },
  { key: 'done', title: 'Done this cycle', color: colors.success, bg: colors.successSoft },
];

type Filter = 'all' | ActionItem['kind'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'card', label: 'Cards' },
  { key: 'bill', label: 'Bills' },
  { key: 'emi', label: 'EMIs' },
  { key: 'document', label: 'Documents' },
];

export default function Actions() {
  const data = useAppData();
  const cycle = useCycle();
  const { money } = useMoney();
  const saveBill = useStore((s) => s.saveBill);
  const saveEmi = useStore((s) => s.saveEmi);
  const [filter, setFilter] = useState<Filter>('all');
  const on = new Date();
  const actions = useMemo(() => generateActions(data, on), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = actions.filter((a) => filter === 'all' || a.kind === filter);
  const toPay = actions.filter((a) => a.status !== 'done' && a.amount).reduce((s, a) => s + (a.amount ?? 0), 0);
  const counts = (k: ActionStatus) => actions.filter((a) => a.status === k).length;

  const pay = (a: ActionItem) => {
    if (a.kind === 'card') return router.push(`/add?type=transfer&to=${a.accountId}&amount=${Math.round(a.amount ?? 0)}`);
    if (a.kind === 'bill') return router.push(`/add?type=expense&billId=${a.billId}`);
    if (a.kind === 'emi') return router.push(`/add?emiId=${a.emiId}`);
    if (a.kind === 'document') return router.push(`/documents?edit=${a.documentId}`);
  };
  const markDone = (a: ActionItem) => {
    const today = toISODate(new Date());
    if (a.kind === 'bill' && a.billId) saveBill({ ...data.bills.find((b) => b.id === a.billId)!, lastPaid: today });
    if (a.kind === 'emi' && a.emiId) saveEmi({ ...data.emis.find((e) => e.id === a.emiId)!, lastPaid: today });
  };

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.primary }}>
        <Text style={{ color: '#ffffffcc', fontSize: 13 }}>This cycle · {cycle.label}</Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{money(toPay)} to pay</Text>
        <Row style={{ gap: 14, flexWrap: 'wrap' }}>
          <Text style={{ color: '#fff' }}>{counts('overdue')} overdue</Text>
          <Text style={{ color: '#fff' }}>{counts('due')} due soon</Text>
          <Text style={{ color: '#fff' }}>{counts('upcoming')} upcoming</Text>
          <Text style={{ color: '#fff' }}>{counts('done')} done</Text>
        </Row>
        <Text style={{ color: '#ffffffcc', fontSize: 12 }}>{cycle.progress.left} days left in this cycle</Text>
      </Card>

      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>

      {shown.length === 0 ? (
        <Empty icon="checkmark-done-circle-outline" title="Nothing to do" text="Add bills, EMIs and documents and they'll show up here when they are due." />
      ) : null}

      {SECTIONS.map((sec) => {
        const items = shown.filter((a) => a.status === sec.key);
        if (!items.length) return null;
        return (
          <View key={sec.key} style={{ gap: 8 }}>
            <SectionTitle title={`${sec.title} · ${items.length}`} />
            {items.map((a) => {
              const days = diffDays(a.date, on);
              const when =
                a.status === 'done' ? `Done ${formatShortDate(a.date)}` : days < 0 ? `${-days} day${days === -1 ? '' : 's'} late · was due ${formatShortDate(a.date)}` : days === 0 ? 'Due today' : `Due ${formatShortDate(a.date)} · in ${days} day${days === 1 ? '' : 's'}`;
              return (
                <Card key={a.id} style={{ padding: 12, gap: 8 }}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: sec.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={a.icon} color={sec.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{a.title}</Text>
                      <Text style={[styles.itemSub, { color: sec.color, fontWeight: '600' }]}>{when}</Text>
                      {a.subtitle ? <Text style={styles.itemSub}>{a.subtitle}</Text> : null}
                    </View>
                    {a.amount ? <Text style={styles.itemRight}>{money(a.amount)}</Text> : null}
                  </Row>
                  {a.status !== 'done' ? (
                    <ChipRow>
                      {a.kind === 'document' ? (
                        <Chip label="Update expiry" icon="create-outline" onPress={() => pay(a)} />
                      ) : (
                        <Chip label="Pay & record" icon="wallet-outline" selected onPress={() => pay(a)} />
                      )}
                      {a.kind === 'bill' || a.kind === 'emi' ? <Chip label="Mark paid" icon="checkmark" onPress={() => markDone(a)} /> : null}
                    </ChipRow>
                  ) : null}
                </Card>
              );
            })}
          </View>
        );
      })}

      <SectionTitle title="Manage" />
      <ChipRow>
        <Chip label="Bills & reminders" icon="receipt-outline" onPress={() => router.push('/bills')} />
        <Chip label="EMIs" icon="calendar-number-outline" onPress={() => router.push('/emis')} />
        <Chip label="Documents" icon="id-card-outline" onPress={() => router.push('/documents')} />
        <Chip label="Spending cycle" icon="sync-outline" onPress={() => router.push('/settings')} />
      </ChipRow>
    </Screen>
  );
}
