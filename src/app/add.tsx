import { ask } from '../components/Dialog';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Switch, Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { Button, Card, Chip, ChipRow, Field, Icon, Row, Screen, styles } from '../components/ui';
import { emiAmount } from '../logic/emi';
import { ACCOUNT_TYPE_ICON } from '../logic/balances';
import { recommendCards } from '../logic/creditCard';
import { addDays, formatShortDate, parseDate, toISODate } from '../logic/dates';
import { normalize } from '../logic/priceBook';
import { matchAccount } from '../logic/receipt';
import { takeScanDraft } from '../store/scanDraft';
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
  const params = useLocalSearchParams<{ id?: string; type?: TxnType; to?: string; amount?: string; billId?: string; emiId?: string; scanned?: string }>();
  // A bill scanned on the Scan screen becomes ONE expense for its total.
  const [scan] = useState(() => (params.scanned ? takeScanDraft() : null));
  const receipt = scan?.receipt;
  const [savePrices, setSavePrices] = useState(false);
  const navigation = useNavigation();
  const store = useStore();
  const balances = useBalances();
  const { money } = useMoney();
  const existing = params.id ? store.transactions.find((t) => t.id === params.id) : undefined;
  const bill = params.billId ? store.bills.find((b) => b.id === params.billId) : undefined;
  const emi = params.emiId ? store.emis.find((e) => e.id === params.emiId) : undefined;
  const existingEmi = existing?.emiPlanId ? store.emis.find((e) => e.id === existing.emiPlanId) : undefined;
  // Paying a loan EMI = transfer into the loan account; other EMIs are expenses.
  const emiIsTransfer = !!emi && !!emi.accountId && store.accounts.find((a) => a.id === emi.accountId)?.type === 'loan';
  const accounts = store.accounts.filter((a) => !a.archived || a.id === existing?.accountId || a.id === existing?.toAccountId);

  const bank = accounts.find((a) => a.type === 'bank')?.id;
  const [type, setType] = useState<TxnType>(existing?.type ?? (emi ? (emiIsTransfer ? 'transfer' : 'expense') : params.type ?? 'expense'));
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : params.amount ?? (receipt?.total ? String(receipt.total) : bill ? String(bill.amount) : emi ? String(emi.monthlyAmount) : ''),
  );
  const [accountId, setAccountId] = useState(
    existing?.accountId ??
      (params.to || emiIsTransfer ? bank : undefined) ??
      bill?.accountId ??
      (emi && !emiIsTransfer ? emi.accountId : undefined) ??
      matchAccount(receipt?.payment, accounts) ??
      accounts[0]?.id ??
      '',
  );
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? params.to ?? (emiIsTransfer ? emi!.accountId! : ''));
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? bill?.categoryId ?? (emi ? 'emi' : receipt?.categoryId ?? ''));
  const [merchant, setMerchant] = useState(existing?.merchant ?? bill?.name ?? (emi && !emiIsTransfer ? `${emi.name} EMI` : receipt?.merchant ?? ''));
  const [memberId, setMemberId] = useState(existing ? existing.memberId ?? '' : store.settings.currentMemberId ?? '');
  const [emiOn, setEmiOn] = useState(!!existingEmi);
  const [emiMonths, setEmiMonths] = useState(existingEmi ? existingEmi.totalMonths : 6);
  const [emiRate, setEmiRate] = useState(existingEmi?.interestRate ? String(existingEmi.interestRate) : '0');
  const [date, setDate] = useState(existing?.date ?? receipt?.date ?? toISODate(new Date()));
  const [note, setNote] = useState(existing?.note ?? (emiIsTransfer ? `${emi!.name} EMI` : receipt ? `Scanned bill${receipt.items.length ? ` · ${receipt.items.length} items` : ''}` : ''));
  const [item, setItem] = useState(existing?.item ?? '');
  const [quantity, setQuantity] = useState(existing?.quantity ? String(existing.quantity) : '');
  const [showMore, setShowMore] = useState(!!(existing?.item || existing?.note));

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit transaction' : bill ? `Pay ${bill.name}` : emi ? `Pay ${emi.name} EMI` : receipt ? 'Scanned bill' : 'Add transaction' });
  }, [navigation, existing, bill, emi, receipt]);

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
    if (!amt || amt <= 0) return ask('Enter an amount');
    if (!accountId) return ask('Choose an account');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return ask('Choose a different destination account');
    if (!date) return ask('Pick a date');
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
    const txnId = existing ? existing.id : store.addTransaction(payload);
    if (existing) store.updateTransaction(existing.id, payload);
    if (bill) store.saveBill({ ...bill, lastPaid: date });
    // Optional: remember item prices from the scanned bill for "cheaper shop" tips
    if (receipt && savePrices && merchant.trim()) {
      for (const it of receipt.items) store.addPrice({ item: it.name, shop: merchant.trim(), price: it.unitPrice, date });
    }
    if (emi) store.saveEmi({ ...emi, lastPaid: date });

    // Credit card purchase converted to EMI
    const isCard = store.accounts.find((a) => a.id === accountId)?.type === 'credit_card';
    if (type === 'expense' && isCard && emiOn) {
      const rate = parseFloat(emiRate) || 0;
      const start = addDays(parseDate(date), 30);
      store.saveEmi({
        id: existingEmi?.id,
        name: merchant.trim() || item.trim() || 'Card purchase',
        kind: 'card_emi',
        accountId,
        transactionId: txnId,
        principal: amt,
        monthlyAmount: emiAmount(amt, rate, emiMonths),
        totalMonths: emiMonths,
        startDate: toISODate(start),
        interestRate: rate,
        remindDaysBefore: 3,
      });
    } else if (existingEmi && !emiOn) {
      store.deleteEmi(existingEmi.id);
    }
    router.back();
  };

  const remove = () =>
    ask('Delete transaction?', undefined, [
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

  const currencyMismatch = receipt?.currency && receipt.currency !== store.settings.currencyCode;

  return (
    <Screen>
      {receipt ? (
        <Card style={{ backgroundColor: colors.infoSoft, padding: 12 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            {scan?.uri ? <Image source={{ uri: scan.uri }} style={{ width: 54, height: 72, borderRadius: 6, backgroundColor: colors.border }} /> : <Icon name="receipt-outline" color={colors.info} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.itemTitle, { color: colors.info }]}>Scanned bill: check the details</Text>
              <Text style={styles.insightText}>
                Saved as one expense for the bill total. Found: {[receipt.merchant && 'shop', receipt.date && 'date', receipt.total && 'total', receipt.payment && 'payment'].filter(Boolean).join(', ') || 'nothing certain'}.
              </Text>
              {receipt.totalConfidence === 'low' ? (
                <Text style={[styles.insightText, { color: colors.warning, fontWeight: '700' }]}>No “Total” line found. Please check the amount.</Text>
              ) : null}
              {!receipt.total ? <Text style={[styles.insightText, { color: colors.warning, fontWeight: '700' }]}>Couldn’t read the total. Please type it in.</Text> : null}
              {!receipt.date ? <Text style={styles.hint}>No date found, so today is used.</Text> : null}
              {currencyMismatch ? <Text style={[styles.insightText, { color: colors.warning }]}>This bill looks like it is in {receipt.currency}, not {store.settings.currencyCode}.</Text> : null}
            </View>
          </Row>
          {receipt.items.length > 0 ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[styles.itemSub, { flex: 1 }]}>Also save the {receipt.items.length} item prices to the price book (for “cheaper shop” tips)</Text>
              <Switch value={savePrices} onValueChange={setSavePrices} trackColor={{ true: colors.primary }} />
            </Row>
          ) : null}
        </Card>
      ) : !existing && type === 'expense' && !bill && !emi ? (
        <Chip label="Scan a bill instead" icon="scan-outline" onPress={() => router.replace('/scan')} />
      ) : null}

      <ChipRow>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} icon={t.icon} selected={type === t.key} onPress={() => setType(t.key)} />
        ))}
      </ChipRow>

      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" autoFocus={!existing && !params.amount && !receipt} style={[styles.input, { fontSize: 28, fontWeight: '700' }]} />

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
            <Chip label="New category" icon="add" onPress={() => router.push(`/categories?kind=${type === 'income' ? 'income' : 'want'}`)} />
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

      <DateField label="Date" value={date} onChange={setDate} />

      {type === 'expense' && store.accounts.find((a) => a.id === accountId)?.type === 'credit_card' ? (
        <Card style={{ padding: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Converted to EMI?</Text>
              <Text style={styles.itemSub}>The card bill will then include only the monthly instalment.</Text>
            </View>
            <Switch value={emiOn} onValueChange={setEmiOn} trackColor={{ true: colors.primary }} />
          </Row>
          {emiOn ? (
            <>
              <ChipRow>
                {[3, 6, 9, 12, 18, 24].map((m) => (
                  <Chip key={m} label={`${m} months`} selected={emiMonths === m} onPress={() => setEmiMonths(m)} />
                ))}
              </ChipRow>
              <Field label="Interest rate % per year (0 for no-cost EMI)" value={emiRate} onChangeText={setEmiRate} keyboardType="decimal-pad" />
              {amt > 0 ? (
                <Text style={[styles.insightText, { color: colors.success, fontWeight: '700' }]}>
                  {money(emiAmount(amt, parseFloat(emiRate) || 0, emiMonths))} × {emiMonths} months
                  {(parseFloat(emiRate) || 0) > 0 ? ` · interest ${money(emiAmount(amt, parseFloat(emiRate) || 0, emiMonths) * emiMonths - amt)}` : ''}
                </Text>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}

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
