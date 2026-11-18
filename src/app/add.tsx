import { ask } from '../components/Dialog';
import { t } from '../i18n';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, Switch, Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { toast } from '../components/Toast';
import { policyBills } from '../logic/trackers';
import { lastRate, PEOPLE_ACCOUNT_ID, personBalances, splitEqually } from '../logic/money2';
import { CURRENCIES } from '../logic/region';
import { deletePhoto, keepPhoto } from '../services/billPhotos';
import { pickImage } from '../services/scanReceipt';
import { Button, Card, Chip, ChipRow, Field, Icon, Row, Screen, styles } from '../components/ui';
import { emiAmount } from '../logic/emi';
import { ACCOUNT_TYPE_ICON, SPENDABLE_TYPES } from '../logic/balances';
import { recommendCards } from '../logic/creditCard';
import { addDays, formatShortDate, parseDate, toISODate } from '../logic/dates';
import { normalize } from '../logic/priceBook';
import { matchAccount } from '../logic/receipt';
import { takeScanDraft } from '../store/scanDraft';
import type { TxnType } from '../logic/types';
import { notifyBalance, useBalances, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const TYPES: { key: TxnType; label: string; icon: string }[] = [
  { key: 'expense', label: t('Expense'), icon: 'remove-circle-outline' },
  { key: 'income', label: t('Income'), icon: 'add-circle-outline' },
  { key: 'transfer', label: t('Transfer'), icon: 'swap-horizontal' },
];

export default function AddTransaction() {
  const params = useLocalSearchParams<{ id?: string; type?: TxnType; to?: string; amount?: string; billId?: string; emiId?: string; scanned?: string; policyId?: string; vehicleId?: string; merchant?: string; categoryId?: string; accountId?: string; voice?: string }>();
  // A bill scanned on the Scan screen becomes ONE expense for its total.
  const [scan] = useState(() => (params.scanned ? takeScanDraft() : null));
  const receipt = scan?.receipt;
  const [savePrices, setSavePrices] = useState(false);
  const navigation = useNavigation();
  const store = useStore();
  const balances = useBalances();
  const { money } = useMoney();
  const existing = params.id ? store.transactions.find((t) => t.id === params.id) : undefined;
  const policy = params.policyId ? store.policies.find((p) => p.id === params.policyId) : undefined;
  // An insurance premium is paid like a bill.
  const bill = params.billId ? store.bills.find((b) => b.id === params.billId) : policy ? policyBills([policy])[0] : undefined;
  const emi = params.emiId ? store.emis.find((e) => e.id === params.emiId) : undefined;
  const existingEmi = existing?.emiPlanId ? store.emis.find((e) => e.id === existing.emiPlanId) : undefined;
  // Paying a loan EMI = transfer into the loan account; other EMIs are expenses.
  const emiIsTransfer = !!emi && !!emi.accountId && store.accounts.find((a) => a.id === emi.accountId)?.type === 'loan';
  // The internal "Lent & borrowed" account is managed from the People screen, not picked here.
  const accounts = store.accounts.filter((a) => a.type !== 'people' && (!a.archived || a.id === existing?.accountId || a.id === existing?.toAccountId));

  const bank = accounts.find((a) => a.type === 'bank')?.id;
  const [type, setType] = useState<TxnType>(existing?.type ?? (emi ? (emiIsTransfer ? 'transfer' : 'expense') : params.type ?? 'expense'));
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : params.amount ?? (receipt?.total ? String(receipt.total) : bill ? String(bill.amount) : emi ? String(emi.monthlyAmount) : ''),
  );
  const [accountId, setAccountId] = useState(
    existing?.accountId ??
      params.accountId ??
      (params.to || emiIsTransfer ? bank : undefined) ??
      bill?.accountId ??
      (emi && !emiIsTransfer ? emi.accountId : undefined) ??
      matchAccount(receipt?.payment, accounts) ??
      accounts[0]?.id ??
      '',
  );
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? params.to ?? (emiIsTransfer ? emi!.accountId! : ''));
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? bill?.categoryId ?? (emi ? 'emi' : params.vehicleId ? 'transport' : params.categoryId ?? receipt?.categoryId ?? ''));
  const [merchant, setMerchant] = useState(existing?.merchant ?? bill?.name ?? (emi && !emiIsTransfer ? `${emi.name} EMI` : params.merchant ?? receipt?.merchant ?? ''));
  const [memberId, setMemberId] = useState(existing ? existing.memberId ?? '' : store.settings.currentMemberId ?? '');
  const [emiOn, setEmiOn] = useState(!!existingEmi);
  const [emiMonths, setEmiMonths] = useState(existingEmi ? existingEmi.totalMonths : 6);
  const [emiRate, setEmiRate] = useState(existingEmi?.interestRate ? String(existingEmi.interestRate) : '0');
  const [date, setDate] = useState(existing?.date ?? receipt?.date ?? toISODate(new Date()));
  const [note, setNote] = useState(existing?.note ?? (emiIsTransfer ? `${emi!.name} EMI` : receipt ? `Scanned bill${receipt.items.length ? ` · ${receipt.items.length} items` : ''}` : ''));
  const [item, setItem] = useState(existing?.item ?? '');
  const [quantity, setQuantity] = useState(existing?.quantity ? String(existing.quantity) : '');
  const [showMore, setShowMore] = useState(!!(existing?.item || existing?.note || existing?.warrantyUntil));
  const [photo, setPhoto] = useState(existing?.photoUri ?? scan?.uri ?? '');
  const [viewPhoto, setViewPhoto] = useState(false);
  const [warranty, setWarranty] = useState(existing?.warrantyUntil ?? '');
  const [vehicleId, setVehicleId] = useState(existing?.vehicleId ?? params.vehicleId ?? '');
  const [odometer, setOdometer] = useState(existing?.odometer ? String(existing.odometer) : '');
  const [litres, setLitres] = useState(existing?.litres ? String(existing.litres) : '');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [splitName, setSplitName] = useState('');
  const [fxOn, setFxOn] = useState(!!existing?.fx && existing.categoryId !== 'remittance');
  const [fxCurrency, setFxCurrency] = useState(existing?.fx?.currency ?? (store.settings.currencyCode === 'USD' ? 'EUR' : 'USD'));
  const [fxAmount, setFxAmount] = useState(existing?.fx ? String(existing.fx.amount) : '');
  const [fxRate, setFxRate] = useState(existing?.fx ? String(existing.fx.rate) : lastRate(store.transactions, 'USD')?.toString() ?? '');
  // Pre-select an open event or trip that covers today.
  const [eventId, setEventId] = useState(
    existing ? existing.eventId ?? '' : store.events.find((e) => !e.closed && e.startDate <= toISODate(new Date()) && (!e.endDate || e.endDate >= toISODate(new Date())))?.id ?? '',
  );

  useEffect(() => {
    navigation.setOptions({ title: existing ? t('Edit transaction') : bill ? `Pay ${bill.name}` : emi ? `Pay ${emi.name} EMI` : receipt ? 'Scanned bill' : 'Add transaction' });
  }, [navigation, existing, bill, emi, receipt]);

  const fxAmt = parseFloat(fxAmount) || 0;
  const fxR = parseFloat(fxRate) || 0;
  const amt = fxOn ? Math.round(fxAmt * fxR * 100) / 100 : parseFloat(amount) || 0;
  const people = useMemo(() => personBalances(store.transactions).map((p) => p.person), [store.transactions]);
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

  const save = async () => {
    if (fxOn && (!fxAmt || !fxR)) return ask('Enter the foreign amount and the exchange rate');
    if (!amt || amt <= 0) return ask('Enter an amount');
    if (!accountId) return ask('Choose an account');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return ask('Choose a different destination account');
    if (!date) return ask('Pick a date');
    const qty = parseFloat(quantity) || undefined;
    // Splitting a bill: my share is the expense; each other share is money they owe me.
    const split = type === 'expense' && !existing && splitWith.length ? splitEqually(amt, splitWith) : null;
    let photoUri: string | undefined = existing?.photoUri;
    if (photo !== (existing?.photoUri ?? '')) {
      try {
        photoUri = photo ? await keepPhoto(photo) : undefined;
      } catch {
        return ask('Could not save the bill photo', 'Please try attaching it again.');
      }
      if (existing?.photoUri && existing.photoUri !== photoUri) deletePhoto(existing.photoUri);
    }
    const payload = {
      type,
      amount: split ? split.mine : amt,
      photoUri: type === 'expense' ? photoUri : undefined,
      warrantyUntil: type === 'expense' ? warranty || undefined : undefined,
      fx: fxOn ? { currency: fxCurrency, amount: fxAmt, rate: fxR } : existing?.categoryId === 'remittance' ? existing.fx : undefined,
      eventId: type !== 'transfer' ? eventId || undefined : undefined,
      vehicleId: type === 'expense' ? vehicleId || undefined : undefined,
      odometer: type === 'expense' && vehicleId ? parseFloat(odometer) || undefined : undefined,
      litres: type === 'expense' && vehicleId ? parseFloat(litres) || undefined : undefined,
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
    if (split) {
      store.ensurePeopleAccount();
      for (const person of splitWith) {
        store.addTransaction({ type: 'transfer', amount: split.each, date, accountId, toAccountId: PEOPLE_ACCOUNT_ID, person, note: `Share of ${merchant.trim() || 'bill'}`, eventId: eventId || undefined });
      }
    }
    if (policy) store.saveItem('policies', { ...policy, lastPaid: date });
    else if (bill) store.saveBill({ ...bill, lastPaid: date });
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
    notifyBalance(accountId, existing ? 'Saved' : type === 'income' ? 'Income added' : type === 'transfer' ? 'Transfer saved' : 'Expense saved');
  };

  // Goes to the recycle bin, so no confirmation: Undo is offered instead.
  const remove = () => {
    const id = existing!.id;
    store.deleteTransaction(id);
    router.back();
    toast('Moved to recycle bin', { label: 'Undo', onPress: () => store.restoreTransaction(id) });
  };

  // Expenses and income use spendable accounts; transfers can also move money into investments, loans, etc.
  const accountChips = (selected: string, onSelect: (id: string) => void, exclude?: string) => (
    <ChipRow>
      {accounts.filter((a) => a.id !== exclude && (type === 'transfer' || SPENDABLE_TYPES.includes(a.type) || a.id === selected)).map((a) => (
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
        <Chip label={t('Scan a bill instead')} icon="scan-outline" onPress={() => router.replace('/scan')} />
      ) : null}

      <ChipRow>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} icon={t.icon} selected={type === t.key} onPress={() => setType(t.key)} />
        ))}
      </ChipRow>

      {fxOn ? (
        <Card style={{ padding: 12 }}>
          <ChipRow>
            {CURRENCIES.filter((c) => c.code !== store.settings.currencyCode).slice(0, 12).map((c) => (
              <Chip key={c.code} label={c.code} selected={fxCurrency === c.code} onPress={() => { setFxCurrency(c.code); setFxRate(lastRate(store.transactions, c.code)?.toString() ?? ''); }} />
            ))}
          </ChipRow>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label={`Amount in ${fxCurrency}`} value={fxAmount} onChangeText={setFxAmount} keyboardType="decimal-pad" placeholder="0" /></View>
            <View style={{ flex: 1 }}><Field label={`1 ${fxCurrency} = ? ${store.settings.currencyCode}`} value={fxRate} onChangeText={setFxRate} keyboardType="decimal-pad" placeholder="rate" /></View>
          </Row>
          <Text style={[styles.itemTitle, { color: colors.primary }]}>= {money(amt)}</Text>
          <Chip label="Back to my currency" icon="close" onPress={() => setFxOn(false)} />
        </Card>
      ) : (
        <Field label={t('Amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" autoFocus={!existing && !params.amount && !receipt} style={[styles.input, { fontSize: 28, fontWeight: '700' }]} />
      )}
      {!fxOn && type !== 'transfer' ? <Chip label={t('Paid in another currency')} icon="globe-outline" onPress={() => setFxOn(true)} /> : null}

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
          <Text style={styles.label}>{t('To')}</Text>
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
          <Text style={styles.label}>{t('Category')}</Text>
          <ChipRow>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
            <Chip label={t('New category')} icon="add" onPress={() => router.push(`/categories?kind=${type === 'income' ? 'income' : 'want'}`)} />
          </ChipRow>
        </>
      )}

      {store.members.length > 1 ? (
        <>
          <Text style={styles.label}>{t('For whom')}</Text>
          <ChipRow>
            <Chip label={t('Whole family')} selected={!memberId} onPress={() => setMemberId('')} />
            {store.members.map((m) => (
              <Chip key={m.id} label={m.name} icon="person-outline" selected={memberId === m.id} onPress={() => setMemberId(m.id)} />
            ))}
          </ChipRow>
        </>
      ) : null}

      <DateField label={t('Date')} value={date} onChange={setDate} />

      {type === 'expense' && store.vehicles.length && (categoryId === 'transport' || vehicleId) ? (
        <Card style={{ padding: 12 }}>
          <Text style={styles.label}>Vehicle (for mileage)</Text>
          <ChipRow>
            <Chip label={t('None')} selected={!vehicleId} onPress={() => setVehicleId('')} />
            {store.vehicles.map((v) => (
              <Chip key={v.id} label={v.name} icon="car-outline" selected={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
            ))}
          </ChipRow>
          {vehicleId ? (
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}><Field label="Odometer (km)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Litres (fuel only)" value={litres} onChangeText={setLitres} keyboardType="decimal-pad" /></View>
            </Row>
          ) : null}
        </Card>
      ) : null}

      {type !== 'transfer' && store.events.some((e) => !e.closed || e.id === eventId) ? (
        <>
          <Text style={styles.label}>{t('Event or trip')}</Text>
          <ChipRow>
            <Chip label={t('None')} selected={!eventId} onPress={() => setEventId('')} />
            {store.events.filter((e) => !e.closed || e.id === eventId).map((e) => (
              <Chip key={e.id} label={e.name} icon="flag-outline" selected={eventId === e.id} onPress={() => setEventId(e.id)} />
            ))}
          </ChipRow>
        </>
      ) : null}

      {type === 'expense' ? (
        <Card style={{ padding: 12 }}>
          <Row>
            {photo ? (
              <Pressable onPress={() => setViewPhoto(true)} accessibilityRole="button" accessibilityLabel="View bill photo">
                <Image source={{ uri: photo }} style={{ width: 54, height: 72, borderRadius: 6, backgroundColor: colors.border }} />
              </Pressable>
            ) : (
              <Icon name="image-outline" color={colors.muted} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{t('Bill photo')}</Text>
              <Text style={styles.itemSub}>{photo ? 'Kept with this expense as proof of purchase.' : 'Optional. Keep the bill as proof of purchase or for warranty.'}</Text>
            </View>
          </Row>
          <ChipRow>
            <Chip label={photo ? 'Retake' : 'Take photo'} icon="camera-outline" onPress={async () => { try { const u = await pickImage('camera'); if (u) setPhoto(u); } catch (e) { ask('Camera', (e as Error).message); } }} />
            <Chip label={t('From gallery')} icon="images-outline" onPress={async () => { const u = await pickImage('library'); if (u) setPhoto(u); }} />
            {photo ? <Chip label={t('Remove')} icon="trash-outline" onPress={() => setPhoto('')} /> : null}
          </ChipRow>
        </Card>
      ) : null}

      {type === 'expense' && !existing ? (
        <Card style={{ padding: 12 }}>
          <Text style={styles.itemTitle}>{t('Split this bill')}</Text>
          <Text style={styles.itemSub}>
            {splitWith.length
              ? `Split equally with ${splitWith.length} ${splitWith.length === 1 ? 'person' : 'people'}: your share ${money(splitEqually(amt, splitWith).mine)}, each owes you ${money(splitEqually(amt, splitWith).each)}.`
              : 'Paid for others too? Their shares are added to Lend & borrow as money they owe you.'}
          </Text>
          <ChipRow>
            {[...new Set([...people, ...splitWith])].map((p) => (
              <Chip key={p} label={p} icon="person-outline" selected={splitWith.includes(p)} onPress={() => setSplitWith((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))} />
            ))}
          </ChipRow>
          <Row>
            <View style={{ flex: 1 }}><Field label="" value={splitName} onChangeText={setSplitName} placeholder="Add a name" /></View>
            <Chip label="Add" icon="add" onPress={() => { const n = splitName.trim(); if (n && !splitWith.includes(n)) setSplitWith([...splitWith, n]); setSplitName(''); }} />
          </Row>
        </Card>
      ) : null}

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
        <Chip label={t('Add item, warranty & note')} icon="add" onPress={() => setShowMore(true)} />
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
          {type === 'expense' ? (
            <DateField label="Warranty until (optional)" value={warranty} onChange={setWarranty} optional quick={false} hint="You’ll be reminded a month before the warranty ends." />
          ) : null}
          <Field label={t('Note')} value={note} onChangeText={setNote} placeholder="Optional" />
        </>
      )}

      <Modal visible={viewPhoto} transparent animationType="fade" onRequestClose={() => setViewPhoto(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000d', justifyContent: 'center' }} onPress={() => setViewPhoto(false)} accessibilityLabel="Close photo">
          {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '85%' }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>

      <Button title={existing ? 'Save changes' : 'Save'} icon="checkmark" onPress={save} />
      {existing ? <Button title={t('Delete')} variant="danger" icon="trash-outline" onPress={remove} /> : null}
    </Screen>
  );
}
