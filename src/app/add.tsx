import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Chip, ChipRow, Field, Icon, Row, Screen, styles } from '../components/ui';
import { ACCOUNT_TYPE_ICON } from '../logic/balances';
import { recommendCards } from '../logic/creditCard';
import { addDays, formatShortDate, parseDate, toISODate } from '../logic/dates';
import { normalize } from '../logic/priceBook';
import type { TxnType } from '../logic/types';
import { useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const TYPES: { key: TxnType; label: string; icon: string }[] = [
  { key: 'expense', label: 'Expense', icon: 'remove-circle-outline' },
  { key: 'income', label: 'Income', icon: 'add-circle-outline' },
  { key: 'transfer', label: 'Transfer', icon: 'swap-horizontal' },
];

export default function AddTransaction() {
  const params = useLocalSearchParams<{ id?: string; type?: TxnType; to?: string; amount?: string }>();
  const navigation = useNavigation();
  const store = useStore();
  const balances = useBalances();
  const { money } = useMoney();
  const existing = params.id ? store.transactions.find((t) => t.id === params.id) : undefined;
  const accounts = store.accounts.filter((a) => !a.archived || a.id === existing?.accountId || a.id === existing?.toAccountId);

  const [type, setType] = useState<TxnType>(existing?.type ?? params.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : params.amount ?? '');
  const [accountId, setAccountId] = useState(
    existing?.accountId ?? (params.to ? accounts.find((a) => a.type === 'bank')?.id : undefined) ?? accounts[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? params.to ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [memberId, setMemberId] = useState(existing?.memberId ?? '');
  const [date, setDate] = useState(existing?.date ?? toISODate(new Date()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [item, setItem] = useState(existing?.item ?? '');
  const [quantity, setQuantity] = useState(existing?.quantity ? String(existing.quantity) : '');
  const [showMore, setShowMore] = useState(!!(existing?.item || existing?.note));

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit transaction' : 'Add transaction' });
  }, [navigation, existing]);

  const amt = parseFloat(amount) || 0;
  const categories = store.categories.filter((c) => (type === 'income' ? c.kind === 'income' : c.kind !== 'income'));

  // Merchants used before, most frequent first – tapping one also picks its usual category.
  const merchants = useMemo(() => {
    const m = new Map<string, { name: string; count: number; categoryId?: string }>();
    for (const t of store.transactions) {
      if (!t.merchant || t.type !== type) continue;
      const k = normalize(t.merchant);
      const cur = m.get(k) ?? { name: t.merchant, count: 0, categoryId: t.categoryId };
      cur.count++;
      m.set(k, cur);
    }
    const q = normalize(merchant);
    return [...m.values()]
      .filter((x) => !q || normalize(x.name).includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [store.transactions, type, merchant]);

  // Cheaper shop hint while typing an item that is in the price book.
  const priceHint = useMemo(() => {
    if (!item.trim()) return null;
    const k = normalize(item);
    const latest = new Map<string, { shop: string; price: number }>();
    for (const p of [...store.prices].sort((a, b) => a.date.localeCompare(b.date))) {
      if (normalize(p.item) === k) latest.set(normalize(p.shop), { shop: p.shop, price: p.price });
    }
    const list = [...latest.values()].sort((a, b) => a.price - b.price);
    return list.length ? list : null;
  }, [item, store.prices]);

  const cardTip = useMemo(() => {
    if (type !== 'expense') return null;
    const cards = store.accounts.filter((a) => a.type === 'credit_card' && !a.archived);
    const recs = recommendCards(cards, balances, parseDate(date), amt);
    if (!recs.length) return null;
    const best = recs[0];
    const current = recs.find((r) => r.account.id === accountId);
    if (current && current.account.id === best.account.id) return { good: true, text: `Great pick – ${best.freeDays} interest-free days, pay by ${formatShortDate(best.dueDate)}.` };
    if (current) return { good: false, id: best.account.id, text: `${best.account.name} gives ${best.freeDays - current.freeDays} more interest-free days (${best.freeDays} vs ${current.freeDays}).` };
    if (!store.settings.payCardsInFull || amt < 500) return null;
    return { good: false, id: best.account.id, text: `Pay with ${best.account.name} to keep this money for ${best.freeDays} more days (if you clear the bill in full).` };
  }, [type, store.accounts, store.settings.payCardsInFull, balances, date, amt, accountId]);

  const save = () => {
    if (!amt || amt <= 0) return Alert.alert('Enter an amount');
    if (!accountId) return Alert.alert('Choose an account');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return Alert.alert('Choose a different destination account');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Date must be YYYY-MM-DD');
    const qty = parseFloat(quantity) || undefined;
    const payload = {
      type,
      amount: amt,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId || (type === 'income' ? 'other_income' : 'other'),
      merchant: type === 'transfer' ? undefined : merchant.trim() || undefined,
      memberId: memberId || undefined,
      note: note.trim() || undefined,
      item: type === 'expense' ? item.trim() || undefined : undefined,
      quantity: type === 'expense' && item.trim() ? qty : undefined,
    };
    if (existing) store.updateTransaction(existing.id, payload);
    else store.addTransaction(payload);
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete transaction?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { store.deleteTransaction(existing!.id); router.back(); } },
    ]);

  const accountChips = (selected: string, onSelect: (id: string) => void, exclude?: string) => (
    <ChipRow>
      {accounts.filter((a) => a.id !== exclude).map((a) => (
        <Chip key={a.id} label={a.name} icon={ACCOUNT_TYPE_ICON[a.type]} selected={selected === a.id} onPress={() => onSelect(a.id)} />
      ))}
      <Chip label="New" icon="add" onPress={() => router.push('/account-form')} />
    </ChipRow>
  );

  return (
    <Screen>
      <ChipRow>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} icon={t.icon} selected={type === t.key} onPress={() => setType(t.key)} />
        ))}
      </ChipRow>

      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" autoFocus={!existing && !params.amount} style={[styles.input, { fontSize: 28, fontWeight: '700' }]} />

      <Text style={styles.label}>{type === 'transfer' ? 'From' : type === 'income' ? 'Received in' : 'Paid with'}</Text>
      {accountChips(accountId, setAccountId)}

      {cardTip ? (
        <Card style={{ backgroundColor: cardTip.good ? colors.successSoft : colors.infoSoft, padding: 12 }}>
          <Row>
            <Icon name={cardTip.good ? 'checkmark-circle' : 'card'} color={cardTip.good ? colors.success : colors.info} />
            <Text style={[styles.insightText, { flex: 1 }]}>{cardTip.text}</Text>
          </Row>
          {!cardTip.good && cardTip.id ? <Chip label="Use this card" onPress={() => setAccountId(cardTip.id!)} /> : null}
        </Card>
      ) : null}

      {type === 'transfer' ? (
        <>
          <Text style={styles.label}>To</Text>
          {accountChips(toAccountId, setToAccountId, accountId)}
          <Text style={styles.hint}>Use transfers for ATM withdrawals, paying credit card bills, or moving money to a wallet.</Text>
        </>
      ) : (
        <>
          <Field label={type === 'income' ? 'From (payer)' : 'Shop / merchant'} value={merchant} onChangeText={setMerchant} placeholder={type === 'income' ? 'e.g. Employer' : 'e.g. FreshMart'} />
          {merchants.length > 0 && normalize(merchant) !== normalize(merchants[0]?.name ?? '') ? (
            <ChipRow>
              {merchants.map((m) => (
                <Chip key={m.name} label={m.name} onPress={() => { setMerchant(m.name); if (!categoryId && m.categoryId) setCategoryId(m.categoryId); }} />
              ))}
            </ChipRow>
          ) : null}
          <Text style={styles.label}>Category</Text>
          <ChipRow>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ChipRow>
        </>
      )}

      {store.members.length > 1 ? (
        <>
          <Text style={styles.label}>For whom</Text>
          <ChipRow>
            <Chip label="Whole family" selected={!memberId} onPress={() => setMemberId('')} />
            {store.members.map((m) => (
              <Chip key={m.id} label={m.name} icon="person-outline" selected={memberId === m.id} onPress={() => setMemberId(m.id)} />
            ))}
          </ChipRow>
        </>
      ) : null}

      <Text style={styles.label}>Date</Text>
      <ChipRow>
        <Chip label="Today" selected={date === toISODate(new Date())} onPress={() => setDate(toISODate(new Date()))} />
        <Chip label="Yesterday" selected={date === toISODate(addDays(new Date(), -1))} onPress={() => setDate(toISODate(addDays(new Date(), -1)))} />
      </ChipRow>
      <Field label="" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

      {!showMore ? (
        <Chip label="Add item, quantity & note" icon="add" onPress={() => setShowMore(true)} />
      ) : (
        <>
          {type === 'expense' ? (
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 2 }}><Field label="Item (optional)" value={item} onChangeText={setItem} placeholder="e.g. Milk" /></View>
              <View style={{ flex: 1 }}><Field label="Qty" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="1" /></View>
            </Row>
          ) : null}
          {priceHint ? (
            <Card style={{ padding: 12 }}>
              <Text style={styles.label}>Price book for “{item.trim()}”</Text>
              {priceHint.slice(0, 4).map((p, i) => (
                <Text key={p.shop} style={[styles.insightText, i === 0 && { color: colors.success, fontWeight: '700' }]}>
                  {i === 0 ? '★ ' : ''}{p.shop}: {money(p.price)}
                </Text>
              ))}
            </Card>
          ) : type === 'expense' && item ? (
            <Text style={styles.hint}>Adding item + qty + shop builds your price book, so the app can find cheaper shops.</Text>
          ) : null}
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
        </>
      )}

      <Button title={existing ? 'Save changes' : 'Save'} icon="checkmark" onPress={save} />
      {existing ? <Button title="Delete" variant="danger" icon="trash-outline" onPress={remove} /> : null}
    </Screen>
  );
}
