import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Field, Icon, ListItem, ProgressBar, Row, Screen, styles } from '../components/ui';
import { t } from '../i18n';
import { toISODate } from '../logic/dates';
import { accountLimitReached, FREE_PER_CATEGORY } from '../logic/region';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const STEPS = ['salary', 'payday', 'cash', 'cards', 'rent'] as const;
type Step = (typeof STEPS)[number];
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** First-time setup: the few things that make every screen useful from day one. */
export default function Setup() {
  const store = useStore();
  const [step, setStep] = useState<Step>('salary');
  const [bankName, setBankName] = useState('Salary account');
  const [bankBalance, setBankBalance] = useState('');
  const [payday, setPayday] = useState(1);
  const [cash, setCash] = useState('');
  const [card, setCard] = useState({ name: '', billingDay: '', dueDay: '', limit: '', outstanding: '' });
  const [cards, setCards] = useState<string[]>([]);
  const [rent, setRent] = useState('');
  const [rentDay, setRentDay] = useState('5');
  const index = STEPS.indexOf(step);

  const next = () => (index < STEPS.length - 1 ? setStep(STEPS[index + 1]) : finish());

  const saveAndNext = () => {
    if (step === 'salary' && bankName.trim()) {
      store.addAccount({ name: bankName.trim(), type: 'bank', openingBalance: parseFloat(bankBalance) || 0 });
    }
    if (step === 'payday') store.updateSettings({ cycleStartDay: payday });
    if (step === 'cash' && parseFloat(cash)) {
      const c = store.accounts.find((a) => a.type === 'cash');
      if (c) store.updateAccount(c.id, { openingBalance: parseFloat(cash) });
      else store.addAccount({ name: 'Cash', type: 'cash', openingBalance: parseFloat(cash) });
    }
    if (step === 'rent' && parseFloat(rent)) {
      const day = Math.min(28, Math.max(1, parseInt(rentDay, 10) || 1));
      const now = new Date();
      store.saveBill({ name: 'House rent', type: 'rent', amount: parseFloat(rent), frequency: 'monthly', dueDate: toISODate(new Date(now.getFullYear(), now.getMonth(), day)), remindDaysBefore: 3, categoryId: 'rent' });
    }
    next();
  };

  const addCard = () => {
    const b = parseInt(card.billingDay, 10);
    const d = parseInt(card.dueDay, 10);
    if (!card.name.trim() || !(b >= 1 && b <= 31) || !(d >= 1 && d <= 31)) return ask('Enter the card name, billing day and due day (1–31)', 'They are printed on your card statement.');
    if (accountLimitReached(store.accounts, 'credit_card', store.settings.premium)) {
      return ask('Free plan limit reached', `The free plan includes ${FREE_PER_CATEGORY} credit cards. Upgrade to Premium to add more.`, [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Premium', onPress: () => router.push('/premium') },
      ]);
    }
    store.addAccount({ name: card.name.trim(), type: 'credit_card', billingDay: b, dueDay: d, creditLimit: parseFloat(card.limit) || undefined, openingBalance: -(parseFloat(card.outstanding) || 0), remindDaysBefore: 5 });
    setCards([...cards, card.name.trim()]);
    setCard({ name: '', billingDay: '', dueDay: '', limit: '', outstanding: '' });
  };

  const finish = () => {
    store.updateSettings({ onboarded: true });
    router.replace('/');
  };

  return (
    <Screen>
      <ProgressBar value={(index + 1) / STEPS.length} plain />
      <Text style={styles.hint}>
        {index + 1} / {STEPS.length}
      </Text>

      {step === 'salary' ? (
        <Card>
          <Icon name="business-outline" size={30} color={colors.primary} />
          <Text style={styles.sectionTitle}>Where does your salary come in?</Text>
          <Field label="Bank account name" value={bankName} onChangeText={setBankName} placeholder="e.g. SBI Savings" />
          <Field label="Balance today" value={bankBalance} onChangeText={setBankBalance} keyboardType="decimal-pad" placeholder="0" />
        </Card>
      ) : null}

      {step === 'payday' ? (
        <Card>
          <Icon name="calendar-outline" size={30} color={colors.primary} />
          <Text style={styles.sectionTitle}>Which day does your salary arrive?</Text>
          <Text style={styles.itemSub}>Your budgets and reports run from this day to the day before the next salary.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {DAYS.map((d) => (
              <Pressable key={d} onPress={() => setPayday(d)} accessibilityRole="button" accessibilityState={{ selected: payday === d }} style={{ width: 40, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: payday === d ? colors.primary : colors.bg }}>
                <Text style={{ color: payday === d ? '#fff' : colors.text, fontWeight: '600' }}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Paid at month end (29th–31st)? Pick 28.</Text>
        </Card>
      ) : null}

      {step === 'cash' ? (
        <Card>
          <Icon name="cash-outline" size={30} color={colors.primary} />
          <Text style={styles.sectionTitle}>How much cash do you have?</Text>
          <Field label="Cash in wallet / at home" value={cash} onChangeText={setCash} keyboardType="decimal-pad" placeholder="0" />
        </Card>
      ) : null}

      {step === 'cards' ? (
        <Card>
          <Icon name="card-outline" size={30} color={colors.primary} />
          <Text style={styles.sectionTitle}>Add your credit cards</Text>
          <Text style={styles.itemSub}>With the billing and due days, FamilyFin tells you which card to use for the longest interest-free time.</Text>
          {cards.map((c) => (
            <ListItem key={c} icon="checkmark-circle" iconColor={colors.success} title={c} />
          ))}
          <Field label="Card name" value={card.name} onChangeText={(v) => setCard({ ...card, name: v })} placeholder="e.g. HDFC Millennia" />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Billing day" value={card.billingDay} onChangeText={(v) => setCard({ ...card, billingDay: v })} keyboardType="number-pad" placeholder="5" /></View>
            <View style={{ flex: 1 }}><Field label="Due day" value={card.dueDay} onChangeText={(v) => setCard({ ...card, dueDay: v })} keyboardType="number-pad" placeholder="25" /></View>
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Credit limit" value={card.limit} onChangeText={(v) => setCard({ ...card, limit: v })} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Outstanding now" value={card.outstanding} onChangeText={(v) => setCard({ ...card, outstanding: v })} keyboardType="decimal-pad" /></View>
          </Row>
          <Button title={cards.length ? 'Add another card' : 'Add card'} variant="secondary" icon="add" onPress={addCard} />
        </Card>
      ) : null}

      {step === 'rent' ? (
        <Card>
          <Icon name="home-outline" size={30} color={colors.primary} />
          <Text style={styles.sectionTitle}>Do you pay rent?</Text>
          <Text style={styles.itemSub}>We’ll remind you 3 days before it’s due. Add EMIs, school fees and other bills later under More.</Text>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 2 }}><Field label="Monthly rent" value={rent} onChangeText={setRent} keyboardType="decimal-pad" placeholder="0" /></View>
            <View style={{ flex: 1 }}><Field label="Due day" value={rentDay} onChangeText={setRentDay} keyboardType="number-pad" /></View>
          </Row>
        </Card>
      ) : null}

      <Button title={index === STEPS.length - 1 ? t('Finish') : t('Next')} icon="arrow-forward" onPress={saveAndNext} />
      <Row>
        {index > 0 ? <View style={{ flex: 1 }}><Button title={t('Back')} variant="secondary" onPress={() => setStep(STEPS[index - 1])} /></View> : null}
        <View style={{ flex: 1 }}><Button title={t('Skip')} variant="secondary" onPress={next} /></View>
      </Row>
    </Screen>
  );
}
