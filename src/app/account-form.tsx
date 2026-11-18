import { DateField } from '../components/DateField';
import { ask } from '../components/Dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, styles } from '../components/ui';
import { ACCOUNT_GROUP_OF, ACCOUNT_GROUPS, ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL, isLiability } from '../logic/balances';
import { accountLimitReached, FREE_LIMITS } from '../logic/region';
import { interestFreeDays } from '../logic/creditCard';
import { addDays, clampedDate } from '../logic/dates';
import type { AccountType } from '../logic/types';
import { useStore } from '../store/useStore';
import { colors } from '../theme';


const validDay = (s: string) => {
  const n = parseInt(s, 10);
  return n >= 1 && n <= 31 ? n : undefined;
};

export default function AccountForm() {
  const params = useLocalSearchParams<{ id?: string; type?: AccountType }>();
  const store = useStore();
  const existing = params.id ? store.accounts.find((a) => a.id === params.id) : undefined;

  const [type, setType] = useState<AccountType>(existing?.type ?? params.type ?? 'bank');
  const [group, setGroup] = useState(ACCOUNT_GROUP_OF[existing?.type ?? params.type ?? 'bank']);
  const [name, setName] = useState(existing?.name ?? '');
  const isCard = type === 'credit_card';
  const owed = isLiability(type);
  const [balance, setBalance] = useState(
    existing ? String(isLiability(existing.type) ? Math.max(0, -existing.openingBalance) : existing.openingBalance) : '',
  );
  const [interest, setInterest] = useState(existing?.interestRate ? String(existing.interestRate) : '');
  const [remindCard, setRemindCard] = useState(existing?.remindDaysBefore ?? 5);
  const [maturityDate, setMaturityDate] = useState(existing?.maturityDate ?? '');
  const [maturityAmount, setMaturityAmount] = useState(existing?.maturityAmount ? String(existing.maturityAmount) : '');
  const [sipAmount, setSipAmount] = useState(existing?.sipAmount ? String(existing.sipAmount) : '');
  const [sipDay, setSipDay] = useState(existing?.sipDay ? String(existing.sipDay) : '');
  const [goldGrams, setGoldGrams] = useState(existing?.goldGrams ? String(existing.goldGrams) : '');
  const [points, setPoints] = useState(existing?.rewardPoints ? String(existing.rewardPoints) : '');
  const [pointValue, setPointValue] = useState(existing?.pointValue ? String(existing.pointValue) : '');
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
    if (!name.trim()) return ask('Give the account a name');
    if (!existing && accountLimitReached(store.accounts, type, store.settings.premium)) {
      return ask(
        'Free plan limit reached',
        `The free plan includes ${FREE_LIMITS.accounts} accounts and ${FREE_LIMITS.creditCards} credit cards. Upgrade to Premium for unlimited.`,
        [{ text: 'Not now', style: 'cancel' }, { text: 'See Premium', onPress: () => router.push('/premium') }],
      );
    }
    if (isCard && (!bd || !dd)) return ask('Billing date needed', 'Enter the day of month your card statement is generated and the day the payment is due (1–31). You can find both on your card statement.');
    const amt = parseFloat(balance) || 0;
    const payload = {
      name: name.trim(),
      type,
      openingBalance: owed ? -Math.abs(amt) : amt,
      interestRate: type === 'loan' || type === 'deposit' ? parseFloat(interest) || undefined : undefined,
      maturityDate: type === 'deposit' ? maturityDate || undefined : undefined,
      maturityAmount: type === 'deposit' ? parseFloat(maturityAmount) || undefined : undefined,
      sipAmount: type === 'investment' ? parseFloat(sipAmount) || undefined : undefined,
      sipDay: type === 'investment' ? validDay(sipDay) : undefined,
      goldGrams: type === 'gold' ? parseFloat(goldGrams) || undefined : undefined,
      rewardPoints: isCard ? parseFloat(points) || undefined : undefined,
      pointValue: isCard ? parseFloat(pointValue) || undefined : undefined,
      remindDaysBefore: isCard ? remindCard : undefined,
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
    ask('Remove account?', 'Accounts with transactions are archived so your history stays correct.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { store.deleteAccount(existing!.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Text style={styles.label}>Category</Text>
      <ChipRow>
        {ACCOUNT_GROUPS.map((g) => (
          <Chip key={g.key} label={g.label} icon={g.icon} selected={group === g.key} onPress={() => { setGroup(g.key); setType(g.types[0]); }} />
        ))}
      </ChipRow>
      {(ACCOUNT_GROUPS.find((g) => g.key === group)?.types.length ?? 0) > 1 ? (
        <>
          <Text style={styles.label}>Type</Text>
          <ChipRow>
            {ACCOUNT_GROUPS.find((g) => g.key === group)!.types.map((t) => (
              <Chip key={t} label={ACCOUNT_TYPE_LABEL[t]} icon={ACCOUNT_TYPE_ICON[t]} selected={type === t} onPress={() => setType(t)} color={colors.info} />
            ))}
          </ChipRow>
        </>
      ) : null}
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
          <Text style={styles.hint}>Spends on a linked debit card reduce that bank’s balance – but you still see “debit card” as the payment mode in reports.</Text>
        </>
      ) : null}

      {!(type === 'debit_card' && linkedBankId) ? (
        <Field
          label={isCard ? 'Current outstanding amount' : type === 'loan' ? 'Outstanding loan amount' : type === 'property' ? 'Current market value' : type === 'investment' ? 'Current value' : 'Current balance'}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
        />
      ) : null}

      {type === 'deposit' ? (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Interest % / year" value={interest} onChangeText={setInterest} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Maturity amount" value={maturityAmount} onChangeText={setMaturityAmount} keyboardType="decimal-pad" /></View>
          </Row>
          <DateField label="Maturity date" value={maturityDate} onChange={setMaturityDate} optional quick={false} hint="You’ll be reminded 15 days before, to decide whether to renew." />
        </Card>
      ) : null}
      {type === 'investment' ? (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Monthly SIP" value={sipAmount} onChangeText={setSipAmount} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="SIP debit day" value={sipDay} onChangeText={setSipDay} keyboardType="number-pad" placeholder="1-31" /></View>
          </Row>
        </Card>
      ) : null}
      {type === 'gold' ? (
        <Field label="Weight in grams" value={goldGrams} onChangeText={setGoldGrams} keyboardType="decimal-pad" hint="Value = weight × today’s price. Update it from Investments." />
      ) : null}
      {type === 'loan' ? (
        <Card>
          <Field label="Interest rate % per year" value={interest} onChangeText={setInterest} keyboardType="decimal-pad" placeholder="e.g. 9.5" />
          <Text style={styles.hint}>Record EMI payments as a Transfer from your bank to this loan, or add the EMI under More → EMIs to get reminders.</Text>
        </Card>
      ) : null}
      {type === 'property' || type === 'investment' || type === 'deposit' ? (
        <Text style={styles.hint}>Counts toward your net worth but not toward money available to spend. Update the value whenever it changes.</Text>
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
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Reward points balance" value={points} onChangeText={setPoints} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Value of 1 point" value={pointValue} onChangeText={setPointValue} keyboardType="decimal-pad" placeholder="e.g. 0.25" /></View>
          </Row>
          <Text style={styles.label}>Remind me before the due date</Text>
          <ChipRow>
            {[1, 3, 5, 7, 10].map((d) => (
              <Chip key={d} label={`${d} day${d === 1 ? '' : 's'}`} selected={remindCard === d} onPress={() => setRemindCard(d)} />
            ))}
          </ChipRow>
        </Card>
      ) : null}

      <Button title="Save" icon="checkmark" onPress={save} />
      {existing ? <Button title="Remove" variant="danger" icon="trash-outline" onPress={remove} /> : null}
    </Screen>
  );
}
