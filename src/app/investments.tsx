import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { ACCOUNT_TYPE_ICON } from '../logic/balances';
import { diffDays, formatDate, parseDate } from '../logic/dates';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

export default function Investments() {
  const data = useAppData();
  const balances = useBalances();
  const updateAccount = useStore((s) => s.updateAccount);
  const { money } = useMoney();
  const [goldPrice, setGoldPrice] = useState('');
  const accounts = data.accounts.filter((a) => !a.archived);
  const deposits = accounts.filter((a) => a.type === 'deposit');
  const funds = accounts.filter((a) => a.type === 'investment');
  const gold = accounts.filter((a) => a.type === 'gold');
  const total = [...deposits, ...funds, ...gold].reduce((s, a) => s + (balances[a.id] ?? 0), 0);
  const sipMonthly = funds.reduce((s, a) => s + (a.sipAmount ?? 0), 0);
  const grams = gold.reduce((s, a) => s + (a.goldGrams ?? 0), 0);

  // Re-values gold: sets the value to grams × today's price, keeping recorded transactions.
  const revalueGold = () => {
    const price = parseFloat(goldPrice);
    if (!price) return ask('Enter today’s price per gram');
    for (const a of gold) {
      if (!a.goldGrams) continue;
      const moved = (balances[a.id] ?? 0) - a.openingBalance;
      updateAccount(a.id, { openingBalance: Math.round(a.goldGrams * price - moved) });
    }
    setGoldPrice('');
  };

  return (
    <Screen>
      <Card>
        <Row>
          <Stat label="Total invested value" value={money(total)} color={colors.success} />
          <Stat label="SIPs every month" value={money(sipMonthly)} />
        </Row>
      </Card>

      <SectionTitle title="Fixed & recurring deposits" />
      <Card>
        {deposits.length === 0 ? <Text style={styles.itemSub}>Add a deposit with its maturity date to get a reminder before it matures.</Text> : null}
        {deposits.map((a) => {
          const days = a.maturityDate ? diffDays(parseDate(a.maturityDate), new Date()) : null;
          return (
            <ListItem
              key={a.id}
              icon={ACCOUNT_TYPE_ICON.deposit}
              title={a.name}
              subtitle={a.maturityDate ? `Matures ${formatDate(a.maturityDate)}${days !== null && days >= 0 ? ` (in ${days} days)` : ' (matured)'}${a.maturityAmount ? ` · ${money(a.maturityAmount)}` : ''}${a.interestRate ? ` · ${a.interestRate}%` : ''}` : 'Tap to add maturity date'}
              right={money(balances[a.id] ?? 0)}
              rightColor={days !== null && days <= 15 ? colors.warning : undefined}
              onPress={() => router.push(`/account-form?id=${a.id}`)}
            />
          );
        })}
      </Card>

      <SectionTitle title="Mutual funds, stocks & SIPs" />
      <Card>
        {funds.length === 0 ? <Text style={styles.itemSub}>Add your funds with the SIP amount and debit day.</Text> : null}
        {funds.map((a) => (
          <ListItem
            key={a.id}
            icon={ACCOUNT_TYPE_ICON.investment}
            title={a.name}
            subtitle={a.sipAmount ? `SIP ${money(a.sipAmount)} on day ${a.sipDay ?? '?'} every month` : 'No SIP set'}
            right={money(balances[a.id] ?? 0)}
            onPress={() => router.push(`/account-form?id=${a.id}`)}
          />
        ))}
        <Text style={styles.hint}>Update the current value now and then by editing the account.</Text>
      </Card>

      <SectionTitle title="Gold & jewellery" />
      <Card>
        {gold.length === 0 ? <Text style={styles.itemSub}>Record gold coins and jewellery by weight; update the value with today’s gold price.</Text> : null}
        {gold.map((a) => (
          <ListItem key={a.id} icon={ACCOUNT_TYPE_ICON.gold} title={a.name} subtitle={a.goldGrams ? `${a.goldGrams} g` : 'Weight not set'} right={money(balances[a.id] ?? 0)} onPress={() => router.push(`/account-form?id=${a.id}`)} />
        ))}
        {grams > 0 ? (
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label={`Today’s price per gram (${grams} g total)`} value={goldPrice} onChangeText={setGoldPrice} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Button title="Update value" variant="secondary" onPress={revalueGold} /></View>
          </Row>
        ) : null}
      </Card>

      <Button title="Add deposit, fund or gold" icon="add" onPress={() => router.push('/account-form?type=investment')} />
    </Screen>
  );
}
