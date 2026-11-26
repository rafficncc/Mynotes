import { premiumOnly } from '../components/PremiumGate';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { formatDate, toISODate } from '../logic/dates';
import { formatMoney } from '../logic/money';
import { lastRate, remittanceStats } from '../logic/money2';
import { CURRENCIES, currencyInfo } from '../logic/region';
import { ledgerAccountId, SPENDABLE_TYPES } from '../logic/balances';
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
    notifyBalance(accountId, `Sent ${fmtTo(received)} home`);
  };

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.primary }}>
        <Text style={{ color: '#ffffffcc' }}>Sent home in {year}</Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{money(stats.sent)}</Text>
        <Text style={{ color: '#ffffffdd' }}>
          {stats.count} transfers · fees {money(stats.fees)}
          {stats.currency ? ` · they received ${formatMoney(stats.received, currencyInfo(stats.currency).symbol, currencyInfo(stats.currency).locale)}` : ''}
        </Text>
      </Card>
      {stats.count > 1 ? (
        <Card>
          <Row>
            <Stat label="Your average rate (after fees)" value={stats.effectiveRate.toFixed(2)} />
            <Stat label="Best rate you got" value={stats.bestRate.toFixed(2)} color={colors.success} />
          </Row>
          <Text style={styles.hint}>Compare the amount received, not just the fee: a “zero fee” service with a worse rate often costs more.</Text>
        </Card>
      ) : null}

      <SectionTitle title="Record a transfer" />
      <Card>
        <Text style={styles.label}>Received in</Text>
        <ChipRow>
          {[...new Set([...HOME_CURRENCIES, ...CURRENCIES.map((c) => c.code)])]
            .filter((c) => c !== family)
            .slice(0, 10)
            .map((c) => (
              <Chip key={c} label={c} selected={to === c} onPress={() => { setTo(c); setRate(lastRate(data.transactions, c)?.toString() ?? ''); }} />
            ))}
        </ChipRow>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label={`Amount sent (${family})`} value={sent} onChangeText={setSent} keyboardType="decimal-pad" placeholder="0" /></View>
          <View style={{ flex: 1 }}><Field label="Fee" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" /></View>
        </Row>
        <Field label={`Rate: 1 ${family} = ? ${to}`} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 22.65" hint="Enter the rate shown by your bank or exchange house." />
        {received > 0 ? <Text style={[styles.itemTitle, { color: colors.success }]}>They receive {fmtTo(received)}</Text> : null}
        <Field label="Sent to" value={recipient} onChangeText={setRecipient} placeholder="e.g. Amma, home loan account" />
        <Text style={styles.label}>Paid from</Text>
        <ChipRow>
          {data.accounts.filter((a) => !a.archived && SPENDABLE_TYPES.includes(a.type)).map((a) => (
            <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </ChipRow>
        <Text style={styles.hint}>Balance: {money(balances[ledgerAccountId(data.accounts, accountId)] ?? 0)}. The amount sent plus the fee is taken from this account.</Text>
        <DateField label="Date" value={date} onChange={setDate} />
        <Button title="Save transfer" icon="paper-plane-outline" onPress={save} />
      </Card>

      {list.length ? <SectionTitle title="History" /> : null}
      {list.length ? (
        <Card>
          {list.slice(0, 30).map((t) => (
            <ListItem
              key={t.id}
              icon="paper-plane-outline"
              title={t.merchant ?? 'Sent home'}
              subtitle={`${formatDate(t.date)} · rate ${t.fx!.rate}${t.fee ? ` · fee ${money(t.fee)}` : ''}`}
              right={money(t.amount)}
              rightSub={formatMoney(t.fx!.amount, currencyInfo(t.fx!.currency).symbol, currencyInfo(t.fx!.currency).locale)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

export default premiumOnly(Remittance, 'Money sent home', 'Track remittances, exchange rates and fees.');
