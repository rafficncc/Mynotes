import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, styles } from '../components/ui';
import { ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL } from '../logic/balances';
import { interestFreeDays } from '../logic/creditCard';
import { addDays, clampedDate } from '../logic/dates';
import type { AccountType } from '../logic/types';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const TYPES: AccountType[] = ['cash', 'bank', 'debit_card', 'credit_card', 'wallet', 'other'];

const validDay = (s: string) => {
  const n = parseInt(s, 10);
  return n >= 1 && n <= 31 ? n : undefined;
};

export default function AccountForm() {
  const params = useLocalSearchParams<{ id?: string; type?: AccountType }>();
  const store = useStore();
  const existing = params.id ? store.accounts.find((a) => a.id === params.id) : undefined;

  const [type, setType] = useState<AccountType>(existing?.type ?? params.type ?? 'bank');
  const [name, setName] = useState(existing?.name ?? '');
  const isCard = type === 'credit_card';
  const [balance, setBalance] = useState(
    existing ? String(isCard ? Math.max(0, -existing.openingBalance) : existing.openingBalance) : '',
  );
  const [limit, setLimit] = useState(existing?.creditLimit ? String(existing.creditLimit) : '');
  const [billingDay, setBillingDay] = useState(existing?.billingDay ? String(existing.billingDay) : '');
  const [dueDay, setDueDay] = useState(existing?.dueDay ? String(existing.dueDay) : '');
  const [reward, setReward] = useState(existing?.rewardRate ? String(existing.rewardRate) : '');
  const [linkedBankId, setLinkedBankId] = useState(existing?.linkedBankId ?? '');
  const banks = store.accounts.filter((a) => a.type === 'bank' && !a.archived);

  const bd = validDay(billingDay);
  const dd = validDay(dueDay);
  let preview: string | null = null;
  if (isCard && bd && dd) {
    const now = new Date();
    const best = addDays(clampedDate(now.getFullYear(), now.getMonth(), bd), 1);
    preview = `Buying on the day after your bill (e.g. ${best.toLocaleDateString('en', { day: 'numeric', month: 'short' })}) gives ${interestFreeDays(best, bd, dd)} interest-free days. Buying on the bill day gives only ${interestFreeDays(clampedDate(now.getFullYear(), now.getMonth(), bd), bd, dd)}.`;
  }

  const save = () => {
    if (!name.trim()) return Alert.alert('Give the account a name');
    if (isCard && (!bd || !dd)) return Alert.alert('Billing date needed', 'Enter the day of month your card statement is generated and the day the payment is due (1–31). You can find both on your card statement.');
    const amt = parseFloat(balance) || 0;
    const payload = {
      name: name.trim(),
      type,
      openingBalance: isCard ? -Math.abs(amt) : amt,
      creditLimit: isCard ? parseFloat(limit) || undefined : undefined,
      billingDay: isCard ? bd : undefined,
      dueDay: isCard ? dd : undefined,
      rewardRate: isCard ? parseFloat(reward) || undefined : undefined,
      linkedBankId: type === 'debit_card' ? linkedBankId || undefined : undefined,
    };
    if (existing) store.updateAccount(existing.id, payload);
    else store.addAccount(payload);
    router.back();
  };

  const remove = () =>
    Alert.alert('Remove account?', 'Accounts with transactions are archived so your history stays correct.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { store.deleteAccount(existing!.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Text style={styles.label}>Type</Text>
      <ChipRow>
        {TYPES.map((t) => (
          <Chip key={t} label={ACCOUNT_TYPE_LABEL[t]} icon={ACCOUNT_TYPE_ICON[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </ChipRow>
      <Field label="Name" value={name} onChangeText={setName} placeholder={isCard ? 'e.g. HDFC Millennia' : 'e.g. SBI Savings'} />

      {type === 'debit_card' ? (
        <>
          <Text style={styles.label}>Linked bank account</Text>
          <ChipRow>
            <Chip label="Not linked" selected={!linkedBankId} onPress={() => setLinkedBankId('')} />
            {banks.map((b) => (
              <Chip key={b.id} label={b.name} selected={linkedBankId === b.id} onPress={() => setLinkedBankId(b.id)} />
            ))}
          </ChipRow>
          <Text style={styles.hint}>Spends on a linked debit card reduce that bank's balance – but you still see “debit card” as the payment mode in reports.</Text>
        </>
      ) : null}

      {!(type === 'debit_card' && linkedBankId) ? (
        <Field
          label={isCard ? 'Current outstanding amount' : 'Current balance'}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
        />
      ) : null}

      {isCard ? (
        <Card style={{ gap: 12 }}>
          <Text style={styles.itemTitle}>Billing cycle (from your card statement)</Text>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field label="Statement / billing day" value={billingDay} onChangeText={setBillingDay} keyboardType="number-pad" placeholder="e.g. 5" hint="Day of month (1-31)" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Payment due day" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" placeholder="e.g. 25" hint="Day of month (1-31)" />
            </View>
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field label="Credit limit" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="e.g. 100000" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Reward rate %" value={reward} onChangeText={setReward} keyboardType="decimal-pad" placeholder="e.g. 1.5" />
            </View>
          </Row>
          {preview ? <Text style={[styles.insightText, { color: colors.success }]}>{preview}</Text> : null}
        </Card>
      ) : null}

      <Button title="Save" icon="checkmark" onPress={save} />
      {existing ? <Button title="Remove" variant="danger" icon="trash-outline" onPress={remove} /> : null}
    </Screen>
  );
}
