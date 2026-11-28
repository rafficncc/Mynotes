import { premiumOnly } from '../components/PremiumGate';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Field, ListItem, Row, Screen, SectionTitle, Stat, styles } from '../components/ui';
import { INVEST_OPTIONS, investOption } from '../logic/balances';
import { monthlySip } from '../logic/payments';
import type { Account } from '../logic/types';
import { diffDays, formatDate, parseDate } from '../logic/dates';
import { useAppData, useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

function Investments() {
  const data = useAppData();
  const balances = useBalances();
  const updateAccount = useStore((s) => s.updateAccount);
  const { money } = useMoney();
  const [goldPrice, setGoldPrice] = useState('');
  const all = data.accounts.filter((a) => !a.archived && ['investment', 'deposit', 'gold'].includes(a.type));
  const gold = all.filter((a) => a.type === 'gold');
  const total = all.reduce((s, a) => s + (balances[a.id] ?? 0), 0);
  const sipTotal = all.reduce((s, a) => s + monthlySip(a), 0);
  const sipCount = all.reduce((s, a) => s + (a.sips?.length ?? 0) + (a.sipAmount ? 1 : 0), 0);
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

  const detail = (a: Account) => {
    if (a.type === 'deposit') {
      const days = a.maturityDate ? diffDays(parseDate(a.maturityDate), new Date()) : null;
      return a.maturityDate ? `Matures ${formatDate(a.maturityDate)}${days !== null && days >= 0 ? ` (in ${days} days)` : ' (matured)'}${a.interestRate ? ` · ${a.interestRate}%` : ''}` : 'Tap to add maturity date';
    }
    if (a.type === 'gold') return a.goldGrams ? `${a.goldGrams} g` : 'Weight not set';
    const n = (a.sips?.length ?? 0) + (a.sipAmount ? 1 : 0);
    if (n) return `${n} SIP${n === 1 ? '' : 's'} · ${money(monthlySip(a))} a month`;
    return (a.investKind ?? 'mutual_fund') === 'mutual_fund' ? 'No SIP yet · tap to add' : undefined;
  };

  return (
    <Screen>
      <Card gradient>
        <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Total invested value</Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{money(total)}</Text>
        <Row>
          <Stat light label="Investments" value={`${all.length}`} />
          <Stat light label="SIPs running" value={`${sipCount}`} color={colors.warning} />
          <Stat light label="SIPs a month" value={money(sipTotal)} color={colors.success} />
        </Row>
      </Card>

      {all.length === 0 ? <Card><Text style={styles.itemSub}>Add mutual funds, stocks, deposits, PPF, EPF, NPS, bonds, gold and more. SIPs are recorded automatically every month.</Text></Card> : null}

      {INVEST_OPTIONS.map((o) => {
        const list = all.filter((a) => investOption(a)?.key === o.key);
        if (!list.length) return null;
        return (
          <View key={o.key} style={{ gap: 8 }}>
            <SectionTitle title={`${o.label} · ${money(list.reduce((s, a) => s + (balances[a.id] ?? 0), 0))}`} />
            <Card style={{ gap: 4 }}>
              {list.map((a) => {
                const sips = [...(a.sipAmount && a.sipDay ? [{ name: a.name, amount: a.sipAmount, day: a.sipDay }] : []), ...(a.sips ?? [])];
                return (
                  <View key={a.id}>
                    <ListItem icon={o.icon} title={a.name} subtitle={detail(a)} right={money(balances[a.id] ?? 0)} onPress={() => router.push(`/account-form?id=${a.id}`)} />
                    {sips.map((s, i) => (
                      <Row key={i} style={{ marginLeft: 50, paddingVertical: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                        <Text style={[styles.itemSub, { flex: 1, marginTop: 0 }]} numberOfLines={1}>{s.name}</Text>
                        <Text style={[styles.itemSub, { marginTop: 0 }]}>{money(s.amount)} · day {s.day}</Text>
                      </Row>
                    ))}
                  </View>
                );
              })}
              {o.key === 'gold' && grams > 0 ? (
                <Row style={{ alignItems: 'flex-end', marginTop: 6 }}>
                  <View style={{ flex: 1 }}><Field label={`Today’s price per gram (${grams} g)`} value={goldPrice} onChangeText={setGoldPrice} keyboardType="decimal-pad" /></View>
                  <View style={{ flex: 1 }}><Button title="Update value" variant="secondary" onPress={revalueGold} /></View>
                </Row>
              ) : null}
            </Card>
          </View>
        );
      })}

      <Text style={[styles.hint, { textAlign: 'center' }]}>Update each value now and then by tapping it.</Text>
      <Button title="Add an investment" icon="add" onPress={() => router.push('/account-form?type=investment')} />
    </Screen>
  );
}

export default premiumOnly(Investments, 'Investments', 'Track mutual funds and SIPs, stocks, deposits, bonds, PPF, EPF, NPS, gold and more, with SIPs recorded automatically.');
