import { router, type Href } from 'expo-router';
import { t } from '../../i18n';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GradientBg } from '../../components/GradientBg';
import { TipCard } from '../../components/TipCard';
import { Chip, ChipRow, Empty, Icon, Row, Screen, SectionTitle } from '../../components/ui';
import { generateActions, type ActionItem, type ActionStatus } from '../../logic/actions';
import { diffDays, toISODate } from '../../logic/dates';
import { toast } from '../../components/Toast';
import { ask, choose } from '../../components/Dialog';
import { canPayFrom } from '../../logic/balances';
import { alreadyPaid, billPayment, emiInterest, emiPayment, premiumPayment } from '../../logic/payments';
import { notifyBalance, useAppData, useBalances, useCycle, useMoney } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { colors, isDark } from '../../theme';

const SECTIONS: { key: ActionStatus; title: string; color: string; bg: string }[] = [
  { key: 'overdue', title: t('Overdue'), color: colors.danger, bg: colors.dangerSoft },
  { key: 'due', title: t('Due soon (reminder reached)'), color: colors.warning, bg: colors.warningSoft },
  { key: 'upcoming', title: t('Later this cycle'), color: colors.info, bg: colors.infoSoft },
  { key: 'done', title: t('Done this cycle'), color: colors.success, bg: colors.successSoft },
];

const GRAD: Record<ActionStatus, string[]> = {
  overdue: ['#C8324A', '#FF9E8A'],
  due: ['#D9861A', '#FFD978'],
  upcoming: ['#2F5FC4', '#9CC3FF'],
  done: ['#0B6E4F', '#7EE3B5'],
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

type Filter = 'all' | ActionItem['kind'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: t('All') },
  { key: 'card', label: t('Cards') },
  { key: 'bill', label: t('Bills') },
  { key: 'emi', label: t('EMIs') },
  { key: 'document', label: t('Documents') },
  { key: 'warranty', label: t('Warranties') },
];

export default function Actions() {
  const data = useAppData();
  const cycle = useCycle();
  const { money } = useMoney();
  const balances = useBalances();
  const saveBill = useStore((s) => s.saveBill);
  const saveEmi = useStore((s) => s.saveEmi);
  const saveItem = useStore((s) => s.saveItem);
  const addTransaction = useStore((s) => s.addTransaction);
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const on = new Date();
  const actions = useMemo(() => generateActions(data, on), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = actions.filter((a) => (filter === 'all' || a.kind === filter) && (!status || a.status === status));
  const toPay = actions.filter((a) => a.status !== 'done' && a.amount).reduce((s, a) => s + (a.amount ?? 0), 0);
  const sel = SECTIONS.find((x) => x.key === status);
  const counts = (k: ActionStatus) => actions.filter((a) => a.status === k).length;

  const pay = (a: ActionItem) => {
    if (a.route) return router.push(a.route as Href);
    if (a.kind === 'card') return router.push(`/add?type=transfer&to=${a.accountId}&amount=${Math.round(a.amount ?? 0)}`);
    if (a.kind === 'bill') return router.push(`/add?type=expense&billId=${a.billId}`);
    if (a.kind === 'emi') return router.push(`/add?emiId=${a.emiId}`);
    if (a.kind === 'document') return router.push(`/documents?edit=${a.documentId}`);
    if (a.kind === 'warranty') return router.push(`/add?id=${a.transactionId}`);
  };
  // Asks which account paid, then records the payment there (so balances follow), unless it was already logged.
  const markDone = (a: ActionItem) => {
    const today = toISODate(new Date());
    let txn: Parameters<typeof addTransaction>[0] | null = null;
    let interest = 0;
    let name = '';
    let markPaid = () => {};
    if (a.kind === 'bill' && a.billId?.startsWith('policy:')) {
      const p = data.policies.find((x) => x.id === a.billId!.slice(7));
      if (!p) return;
      markPaid = () => saveItem('policies', { ...p, lastPaid: today });
      name = `${p.name} premium`;
      txn = premiumPayment(p, data.accounts, today);
    } else if (a.kind === 'bill' && a.billId) {
      const b = data.bills.find((x) => x.id === a.billId);
      if (!b) return;
      markPaid = () => saveBill({ ...b, lastPaid: today });
      name = b.name;
      txn = billPayment(b, data.accounts, today);
    } else if (a.kind === 'emi' && a.emiId) {
      const e = data.emis.find((x) => x.id === a.emiId);
      if (!e) return;
      markPaid = () => saveEmi({ ...e, lastPaid: today });
      name = `${e.name} EMI`;
      txn = emiPayment(e, data.accounts, today);
      // Loan EMI: only the principal reduces the loan; the interest part is an expense.
      if (txn?.type === 'transfer') interest = emiInterest(e, data.accounts, balances, txn.amount);
    }
    if (alreadyPaid(name, data.transactions, new Date())) {
      markPaid();
      return toast(`${name} marked paid (payment was already recorded)`);
    }
    if (!txn) return ask('Add an account first', 'Add the bank, cash or card account you pay bills from.');
    // A card EMI is charged to its card, so there is nothing to choose.
    const charged = txn.type === 'expense' && data.accounts.find((x) => x.id === txn!.accountId)?.type === 'credit_card' && a.kind === 'emi';
    const record = (accountId: string) => {
      markPaid();
      addTransaction({ ...txn!, accountId, amount: txn!.amount - interest });
      if (interest) addTransaction({ type: 'expense', amount: interest, date: txn!.date, accountId, categoryId: 'emi', merchant: `${name} interest` });
      notifyBalance(accountId, `${name} paid`);
    };
    if (charged) return record(txn.accountId);
    const payable = data.accounts.filter((x) => !x.archived && canPayFrom(x) && !(x.type === 'debit_card' && x.linkedBankId));
    choose(`Paid ${name} from?`, `${money(txn.amount)} will be taken from the account you choose.`, [
      ...payable.map((x) => ({ text: `${x.name} (${money(balances[x.id] ?? 0)})`, onPress: () => record(x.id) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen>
      <TipCard
        id="actions"
        title="How the Actions tab works"
        points={[
          'Everything to pay or renew in your spending cycle is listed here: card bills, bills, EMIs, insurance, documents and warranties.',
          'Red = overdue, orange = the reminder date has come, blue = later this cycle.',
          '“Pay & record” lets you choose the account and details; “Mark paid” asks which account you paid from and records it (skipped if you already logged it).',
          'Set how many days before you want a reminder on each bill, EMI, card or document.',
        ]}
      />
      {/* What's left to pay, in the app's hero colours */}
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <GradientBg id="actbg" />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff12', top: -80, right: -60 }} />
        <View style={{ padding: 16, gap: 12 }}>
          <View>
            <Text style={{ color: '#ffffffaa', fontSize: 13 }}>
              This cycle · {cycle.label} · {cycle.progress.left} days left
            </Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{money(toPay)}</Text>
            <Text style={{ color: '#FFD978', fontSize: 13, fontWeight: '700' }}>still to pay</Text>
          </View>
          <Row style={{ gap: 8 }}>
            {(
              [
                ['overdue', 'Overdue', '#FF9E8A', 'alert-circle'],
                ['due', 'Due soon', '#FFD978', 'time'],
                ['upcoming', 'Later', '#9CC3FF', 'calendar'],
                ['done', 'Done', '#7EE3B5', 'checkmark-done'],
              ] as const
            ).map(([k, label, c, icon]) => {
              const on = status === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setStatus(on ? null : k)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${label}: ${counts(k)}`}
                  style={{ flex: 1, backgroundColor: on ? '#fff' : '#ffffff1a', borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: on ? c : '#ffffff26' }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#1B1F5E' : c + '33' }}>
                    <Icon name={icon} size={15} color={c} />
                  </View>
                  <Text style={{ color: on ? '#1B1F5E' : c, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>{counts(k)}</Text>
                  <Text style={{ color: on ? '#1B1F5E' : '#ffffffd9', fontSize: 11, fontWeight: '700' }}>{label}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
      </View>

      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>

      {sel ? (
        <Pressable onPress={() => setStatus(null)} accessibilityRole="button" style={{ borderRadius: 14, overflow: 'hidden' }}>
          <GradientBg id="actfilter" />
          <Row style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GRAD[sel.key][1] }} />
            <Text style={{ flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 }}>
              Showing only <Text style={{ color: GRAD[sel.key][1], fontWeight: '900' }}>{sel.title.replace(/ \(.*\)/, '')}</Text>
            </Text>
            <View style={{ backgroundColor: '#ffffff26', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Clear ✕</Text>
            </View>
          </Row>
        </Pressable>
      ) : null}

      {shown.length === 0 ? (
        <Empty icon="checkmark-done-circle-outline" title={t('Nothing to do')} text="Add bills, EMIs and documents and they'll show up here when they are due." />
      ) : null}

      {SECTIONS.map((sec) => {
        const items = shown.filter((a) => a.status === sec.key);
        if (!items.length) return null;
        return (
          <View key={sec.key} style={{ gap: 10 }}>
            <Row style={{ gap: 8, marginTop: 8 }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: GRAD[sec.key][1] }} />
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted, flex: 1 }}>{sec.title.replace(/ \(.*\)/, '').toUpperCase()}</Text>
              <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>
                {items.length} item{items.length === 1 ? '' : 's'}
                {items.some((x) => x.amount) ? ` · ${money(items.reduce((t2, x) => t2 + (x.amount ?? 0), 0))}` : ''}
              </Text>
            </Row>
            {items.map((a) => {
              const days = diffDays(a.date, on);
              const done = a.status === 'done';
              const chip = done ? 'Done' : days < 0 ? `${-days} day${days === -1 ? '' : 's'} late` : days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
              const [c1, c2] = GRAD[sec.key];
              const gid = `ag${a.id.replace(/[^a-zA-Z0-9]/g, '')}`;
              return (
                <View key={a.id} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 12, gap: 12, borderWidth: 1, borderColor: colors.border, opacity: done ? 0.75 : 1 }}>
                  <Row style={{ alignItems: 'center', gap: 12 }}>
                    {/* Calendar-style date block in the status colour */}
                    <View style={{ width: 54, height: 58, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                      <GradientBg id={gid} colors={[c1, c2]} />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{MONTHS[a.date.getMonth()]}</Text>
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 26 }}>{a.date.getDate()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Row style={{ gap: 6 }}>
                        <Icon name={done ? 'checkmark-circle' : a.icon} color={c1} size={15} />
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                          {a.title}
                        </Text>
                      </Row>
                      {a.subtitle ? (
                        <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                          {a.subtitle}
                        </Text>
                      ) : null}
                      <Row style={{ gap: 8 }}>
                        <View style={{ backgroundColor: c2 + '33', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: isDark ? c2 : c1, fontSize: 11, fontWeight: '800' }}>{chip}</Text>
                        </View>
                        {a.amount ? <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, marginLeft: 'auto' }}>{money(a.amount)}</Text> : null}
                      </Row>
                    </View>
                  </Row>
                  {!done ? (
                    <Row style={{ gap: 8 }}>
                      <Pressable onPress={() => pay(a)} accessibilityRole="button" style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
                        <GradientBg id={`${gid}p`} />
                        <Row style={{ gap: 6, justifyContent: 'center', paddingVertical: 10 }}>
                          <Icon name={a.kind === 'document' ? 'create-outline' : a.kind === 'warranty' ? 'receipt-outline' : 'wallet-outline'} size={15} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{a.kind === 'document' ? t('Update expiry') : a.kind === 'warranty' ? t('View purchase') : t('Pay & record')}</Text>
                        </Row>
                      </Pressable>
                      {a.kind === 'bill' || a.kind === 'emi' ? (
                        <Pressable
                          onPress={() => markDone(a)}
                          accessibilityRole="button"
                          style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7EE3B526', borderRadius: 12, paddingVertical: 10 }}
                        >
                          <Icon name="checkmark-circle" size={15} color={colors.success} />
                          <Text style={{ color: colors.success, fontWeight: '800', fontSize: 13 }}>{t('Mark paid')}</Text>
                        </Pressable>
                      ) : null}
                    </Row>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      <SectionTitle title={t('Manage')} />
      <ChipRow>
        <Chip label={t('Bills & reminders')} icon="receipt-outline" onPress={() => router.push('/bills')} />
        <Chip label={t('EMIs')} icon="calendar-number-outline" onPress={() => router.push('/emis')} />
        <Chip label={t('Documents')} icon="id-card-outline" onPress={() => router.push('/documents')} />
        <Chip label={t('Spending cycle')} icon="sync-outline" onPress={() => router.push('/settings')} />
      </ChipRow>
    </Screen>
  );
}
