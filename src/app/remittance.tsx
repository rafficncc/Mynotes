import { premiumOnly } from '../components/PremiumGate';
import { useMemo, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Field, Icon, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { formatDate, toISODate } from '../logic/dates';
import { formatMoney } from '../logic/money';
import { lastRate, remittanceStats } from '../logic/money2';
import { currencyInfo } from '../logic/region';
import { canPayFrom, ledgerAccountId } from '../logic/balances';
import { notifyBalance, useAppData, useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const HOME_CURRENCIES = ['INR', 'PKR', 'BDT', 'LKR', 'NPR', 'PHP', 'EGP', 'KES', 'NGN'];

function Remittance() {
  const data = useAppData();
  const addTransaction = useStore((s) => s.addTransaction);
  const { money } = useMoney();
  const balances = useBalances();
  const family = data.settings.currencyCode;
  const [to, setTo] = useState(family === 'INR' ? HOME_CURRENCIES[1] : 'INR');
  const [sent, setSent] = useState('');
  const [fee, setFee] = useState('');
  const [rate, setRate] = useState(lastRate(data.transactions, to)?.toString() ?? '');
  const [recipient, setRecipient] = useState('');
  const [accountId, setAccountId] = useState(data.accounts.find((a) => a.type === 'bank')?.id ?? data.accounts[0]?.id ?? '');
  const [date, setDate] = useState(toISODate(new Date()));
  const [open, setOpen] = useState(false);

  const list = useMemo(
    () => data.transactions.filter((t) => t.type === 'expense' && t.categoryId === 'remittance' && t.fx).sort((a, b) => b.date.localeCompare(a.date)),
    [data.transactions],
  );
  const year = new Date().getFullYear().toString();
  const stats = remittanceStats(list.filter((t) => t.date.startsWith(year)));
  const s = parseFloat(sent) || 0;
  const r = parseFloat(rate) || 0;
  const received = Math.round(s * r * 100) / 100;
  const toInfo = currencyInfo(to);
  const fmtTo = (n: number) => formatMoney(n, toInfo.symbol, toInfo.locale);

  const save = () => {
    if (!s || !r) return ask('Enter the amount sent and the exchange rate');
    const f = parseFloat(fee) || 0;
    addTransaction({
      type: 'expense',
      categoryId: 'remittance',
      amount: s + f,
      fee: f || undefined,
      fx: { currency: to, amount: received, rate: r },
      accountId,
      date,
      merchant: recipient.trim() || 'Sent home',
      note: `${fmtTo(received)} at ${r}`,
    });
    setSent('');
    setFee('');
    setOpen(false);
    notifyBalance(accountId, `Sent ${fmtTo(received)} home`);
  };

  const theirs = stats.currency ? currencyInfo(stats.currency) : null;
  const showForm = open;

  return (
    <Screen>
      {/* This year at a glance */}
      <Card gradient>
        <Text style={{ color: '#ffffffd9', fontSize: 12 }}>Record money you send to family in another country: the fee, the exchange rate and what they received.</Text>
        <Text style={{ color: '#ffffffb3', fontSize: 13, marginTop: 6 }}>Sent home in {year}</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{money(stats.sent)}</Text>
        <Row>
          <Stat light label="Transfers" value={`${stats.count}`} />
          <Stat light label="Fees paid" value={money(stats.fees)} color={colors.warning} />
          <Stat light label="Family received" value={theirs ? formatMoney(stats.received, theirs.symbol, theirs.locale) : '–'} color={colors.success} />
        </Row>
        {stats.count > 1 ? <Text style={{ color: '#ffffffb3', fontSize: 12 }}>⭐ Best rate this year: {stats.bestRate.toFixed(2)}</Text> : null}
      </Card>

      {!showForm ? <Button title="Record a transfer" icon="paper-plane-outline" onPress={() => setOpen(true)} /> : null}

      {showForm ? (
        <>
          <SectionTitle title="Record a transfer" />
          <Card style={{ gap: 14 }}>
            <Step n={1} title="How much did you send?">
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 2 }}><Field label={`Amount (${family})`} value={sent} onChangeText={setSent} keyboardType="decimal-pad" placeholder="0" /></View>
                <View style={{ flex: 1 }}><Field label="Fee" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" /></View>
              </Row>
            </Step>

            <Step n={2} title="What rate did you get?">
              <ChipRow>
                {HOME_CURRENCIES.filter((c) => c !== family).slice(0, 6).map((c) => (
                  <Chip key={c} label={c} selected={to === c} onPress={() => { setTo(c); setRate(lastRate(data.transactions, c)?.toString() ?? ''); }} />
                ))}
              </ChipRow>
              <Field label={`1 ${family} = how many ${to}?`} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 22.65" hint="Shown on your receipt from the bank or exchange house." />
            </Step>

            {received > 0 ? (
              <View style={{ backgroundColor: colors.successSoft, borderRadius: 14, padding: 12, gap: 2 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Your family receives</Text>
                <Text style={{ color: colors.success, fontSize: 24, fontWeight: '900' }}>{fmtTo(received)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>You pay {money(s + (parseFloat(fee) || 0))} including the fee</Text>
              </View>
            ) : null}

            <Step n={3} title="Who and from where?">
              <Field label="Sent to" value={recipient} onChangeText={setRecipient} placeholder="e.g. Amma" />
              <Text style={styles.label}>Paid from</Text>
              <ChipRow>
                {data.accounts.filter((a) => !a.archived && canPayFrom(a)).map((a) => (
                  <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
                ))}
              </ChipRow>
              <Text style={styles.hint}>Balance {money(balances[ledgerAccountId(data.accounts, accountId)] ?? 0)}</Text>
              <DateField label="Date" value={date} onChange={setDate} />
            </Step>

            <Button title="Save transfer" icon="checkmark" onPress={save} />
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          </Card>
        </>
      ) : null}

      {list.length ? <SectionTitle title="Past transfers" /> : null}
      {list.slice(0, 30).map((t) => {
        const fx = currencyInfo(t.fx!.currency);
        return (
          <Card key={t.id} style={{ padding: 14, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.itemTitle} numberOfLines={1}>{t.merchant ?? 'Sent home'}</Text>
              <Text style={styles.hint}>{formatDate(t.date)}</Text>
            </Row>
            <Row style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{money(t.amount)}</Text>
              <Icon name="arrow-forward" size={16} color={colors.muted} />
              <Text style={{ color: colors.success, fontSize: 16, fontWeight: '800' }}>{formatMoney(t.fx!.amount, fx.symbol, fx.locale)}</Text>
            </Row>
            <Text style={styles.hint}>
              Rate {t.fx!.rate}
              {t.fee ? ` · fee ${money(t.fee)}` : ' · no fee'}
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ gap: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{n}</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
      </Row>
      {children}
    </View>
  );
}

export default premiumOnly(Remittance, 'Money sent home', 'For families living abroad: record the money you send to family back home, the fee and exchange rate, and see how much they received.');
