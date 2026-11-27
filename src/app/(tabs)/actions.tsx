import { router, type Href } from 'expo-router';
import { t } from '../../i18n';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GradientBg } from '../../components/GradientBg';
import { TipCard } from '../../components/TipCard';
import { Chip, ChipRow, Empty, Icon, Row, Screen, SectionTitle } from '../../components/ui';
import { generateActions, type ActionItem, type ActionStatus } from '../../logic/actions';
import { diffDays, formatShortDate, toISODate } from '../../logic/dates';
import { toast } from '../../components/Toast';
import { ask, choose } from '../../components/Dialog';
import { SPENDABLE_TYPES } from '../../logic/balances';
import { alreadyPaid, billPayment, emiPayment, premiumPayment } from '../../logic/payments';
import { notifyBalance, useAppData, useBalances, useCycle, useMoney } from '../../store/hooks';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme';

const SECTIONS: { key: ActionStatus; title: string; color: string; bg: string }[] = [
  { key: 'overdue', title: t('Overdue'), color: colors.danger, bg: colors.dangerSoft },
  { key: 'due', title: t('Due soon (reminder reached)'), color: colors.warning, bg: colors.warningSoft },
  { key: 'upcoming', title: t('Later this cycle'), color: colors.info, bg: colors.infoSoft },
  { key: 'done', title: t('Done this cycle'), color: colors.success, bg: colors.successSoft },
];

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
  const on = new Date();
  const actions = useMemo(() => generateActions(data, on), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = actions.filter((a) => filter === 'all' || a.kind === filter);
  const toPay = actions.filter((a) => a.status !== 'done' && a.amount).reduce((s, a) => s + (a.amount ?? 0), 0);
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
      addTransaction({ ...txn!, accountId });
      notifyBalance(accountId, `${name} paid`);
    };
    if (charged) return record(txn.accountId);
    const payable = data.accounts.filter((x) => !x.archived && SPENDABLE_TYPES.includes(x.type) && !(x.type === 'debit_card' && x.linkedBankId));
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
                ['overdue', 'Overdue', '#FF9E8A'],
                ['due', 'Due soon', '#FFD978'],
                ['upcoming', 'Later', '#9CC3FF'],
                ['done', 'Done', '#7EE3B5'],
              ] as const
            ).map(([k, label, c]) => (
              <View key={k} style={{ flex: 1, backgroundColor: '#ffffff1a', borderRadius: 12, paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: c, fontSize: 20, fontWeight: '800' }}>{counts(k)}</Text>
                <Text style={{ color: '#ffffffcc', fontSize: 11 }}>{label}</Text>
              </View>
            ))}
          </Row>
        </View>
      </View>

      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>

      {shown.length === 0 ? (
        <Empty icon="checkmark-done-circle-outline" title={t('Nothing to do')} text="Add bills, EMIs and documents and they'll show up here when they are due." />
      ) : null}

      {SECTIONS.map((sec) => {
        const items = shown.filter((a) => a.status === sec.key);
        if (!items.length) return null;
        return (
          <View key={sec.key} style={{ gap: 10 }}>
            <Row style={{ gap: 8, marginTop: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sec.color }} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 }}>{sec.title}</Text>
              <View style={{ backgroundColor: sec.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ color: sec.color, fontWeight: '800', fontSize: 12 }}>{items.length}</Text>
              </View>
            </Row>
            {items.map((a) => {
              const days = diffDays(a.date, on);
              const done = a.status === 'done';
              const chip = done ? `Done ${formatShortDate(a.date)}` : days < 0 ? `${-days} day${days === -1 ? '' : 's'} late` : days === 0 ? 'Due today' : `in ${days} day${days === 1 ? '' : 's'}`;
              return (
                <View key={a.id} style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', opacity: done ? 0.7 : 1 }}>
                  <View style={{ width: 5, backgroundColor: sec.color }} />
                  <View style={{ flex: 1, padding: 14, gap: 10 }}>
                    <Row style={{ alignItems: 'flex-start', gap: 12 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: sec.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={done ? 'checkmark' : a.icon} color={sec.color} size={20} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={2}>
                          {a.title}
                        </Text>
                        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                          <View style={{ backgroundColor: sec.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: sec.color, fontSize: 11, fontWeight: '800' }}>{chip}</Text>
                          </View>
                          {!done ? <Text style={{ fontSize: 12, color: colors.muted }}>{formatShortDate(a.date)}</Text> : null}
                        </Row>
                        {a.subtitle ? (
                          <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={2}>
                            {a.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {a.amount ? <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{money(a.amount)}</Text> : null}
                    </Row>
                    {!done ? (
                      <Row style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => pay(a)}
                          accessibilityRole="button"
                          style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 9 }}
                        >
                          <Icon name={a.kind === 'document' ? 'create-outline' : a.kind === 'warranty' ? 'receipt-outline' : 'wallet-outline'} size={16} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{a.kind === 'document' ? t('Update expiry') : a.kind === 'warranty' ? t('View purchase') : t('Pay & record')}</Text>
                        </Pressable>
                        {a.kind === 'bill' || a.kind === 'emi' ? (
                          <Pressable
                            onPress={() => markDone(a)}
                            accessibilityRole="button"
                            style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingVertical: 8 }}
                          >
                            <Icon name="checkmark" size={16} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{t('Mark paid')}</Text>
                          </Pressable>
                        ) : null}
                      </Row>
                    ) : null}
                  </View>
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
