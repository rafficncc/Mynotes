import { ask } from '../components/Dialog';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, Share, Switch, Text, TextInput, View } from 'react-native';
import { PinPad } from '../components/LockScreen';
import { pinLength } from '../services/appLock';
import { GoogleBackupPanel } from '../components/GoogleBackup';
import { Button, Card, Chip, ChipRow, ListItem, Row, Screen, SectionTitle, styles } from '../components/ui';
import { transactionsToCsv } from '../logic/csv';
import { cycleLabel, currentCycleKey } from '../logic/dates';
import { CURRENCIES, currencyInfo, premiumPrice } from '../logic/region';
import { notificationsSupported, requestReminderPermission, syncReminders } from '../services/notifications';
import { useAppData, useMoney } from '../store/hooks';
import { useStore } from '../store/useStore';
import { changeLanguage, LANGUAGES, t } from '../i18n';
import { colors } from '../theme';
import { getLangPref, getThemePref, setThemePref, type LangPref, type ThemePref } from '../theme/prefs';

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function Settings() {
  const data = useAppData();
  const { money } = useMoney();
  const { updateSettings, loadDemo, resetAll } = useStore();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const s = data.settings;
  const [langPref, setLangPrefState] = useState<LangPref>(getLangPref());
  const [themePref, setThemePrefState] = useState<ThemePref>(getThemePref());
  const cur = currencyInfo(s.currencyCode);
  const [pinFor, setPinFor] = useState<'erase' | 'demo' | null>(null);

  // Wiping data needs the app PIN, so someone else holding the phone can't erase it.
  const withPin = async (action: 'erase' | 'demo') => {
    if (!(await pinLength())) {
      return ask('Set a PIN first', 'To protect your data, erasing or replacing it needs your app PIN. Set one in Security & privacy.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set PIN', onPress: () => router.push('/security') },
      ]);
    }
    setPinFor(action);
  };
  const afterPin = () => {
    const action = pinFor;
    setPinFor(null);
    if (action === 'demo') {
      ask('Load demo data?', 'This replaces everything in the app with sample family data.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load', onPress: () => { loadDemo(); router.replace('/'); } },
      ]);
    } else {
      ask('Erase everything?', 'All accounts, transactions, budgets and goals will be deleted. This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => { resetAll(); router.replace('/'); } },
      ]);
    }
  };

  const currencies = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = CURRENCIES.filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    return showAll || q ? list : list.slice(0, 8);
  }, [query, showAll]);

  const share = async (title: string, message: string) => {
    try {
      await Share.share({ title, message });
    } catch {
      ask('Could not open the share sheet');
    }
  };

  const toggleReminders = async (on: boolean) => {
    if (on && notificationsSupported) {
      const ok = await requestReminderPermission();
      if (!ok) return ask('Notifications are blocked', 'Allow notifications for FamilyFin in your phone settings to get reminders.');
    }
    updateSettings({ notificationsEnabled: on });
  };

  const testReminders = async () => {
    const ok = await requestReminderPermission();
    if (!ok) return ask('Notifications are blocked', 'Allow notifications for FamilyFin in your phone settings.');
    const n = await syncReminders(data, money);
    ask('Reminders scheduled', `${n} reminder${n === 1 ? '' : 's'} set for the next 90 days.`);
  };

  return (
    <Screen>
      <SectionTitle title={t('Language')} />
      <ChipRow>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.key}
            label={l.key === 'auto' ? t(l.label) : l.label}
            selected={langPref === l.key}
            onPress={() => {
              setLangPrefState(l.key);
              const restart = changeLanguage(l.key);
              ask(restart ? t('Close and reopen FamilyFin to apply.') : 'OK', restart ? undefined : 'Screens you open now use the new language. Close and reopen the app to switch everything.');
            }}
          />
        ))}
      </ChipRow>

      <SectionTitle title={t('Theme')} />
      <ChipRow>
        {(
          [
            ['system', 'Same as phone'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ] as [ThemePref, string][]
        ).map(([k, l]) => (
          <Chip
            key={k}
            label={t(l)}
            icon={k === 'dark' ? 'moon-outline' : k === 'light' ? 'sunny-outline' : 'phone-portrait-outline'}
            selected={themePref === k}
            onPress={() => {
              setThemePref(k);
              setThemePrefState(k);
              ask(t('Close and reopen FamilyFin to apply.'));
            }}
          />
        ))}
      </ChipRow>

      <SectionTitle title={t('Spending cycle')} />
      <Card>
        <Text style={styles.itemSub}>
          Pick the day your month starts – usually salary day. Budgets, reports and Actions follow this cycle. Current cycle: {cycleLabel(currentCycleKey(new Date(), s.cycleStartDay), s.cycleStartDay)}.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((d) => (
            <Pressable
              key={d}
              onPress={() => updateSettings({ cycleStartDay: d })}
              style={{ width: 40, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: s.cycleStartDay === d ? colors.primary : colors.bg }}
            >
              <Text style={{ color: s.cycleStartDay === d ? '#fff' : colors.text, fontWeight: '600' }}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Day 1 = calendar month. For salary on the 29th–31st, pick 28.</Text>
      </Card>

      <SectionTitle title={t('Currency & country')} />
      <Card>
        <Text style={styles.itemSub}>
          {cur.name} ({cur.code}). Savings tips are tuned to your region and Premium is priced in your currency.
        </Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search currency or country" placeholderTextColor={colors.muted} style={styles.input} />
        <ChipRow>
          {currencies.map((c) => (
            <Chip
              key={c.code}
              label={c.symbol.trim() === c.code ? c.code : `${c.symbol.trim()} ${c.code}`}
              selected={s.currencyCode === c.code}
              onPress={() => updateSettings({ currencyCode: c.code, currency: c.symbol, locale: c.locale })}
            />
          ))}
          {!showAll && !query ? <Chip label={`All ${CURRENCIES.length}`} icon="chevron-down" onPress={() => setShowAll(true)} /> : null}
        </ChipRow>
      </Card>

      <SectionTitle title={t('Reminders')} />
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Payment & expiry reminders</Text>
            <Text style={styles.itemSub}>Phone notifications at 9 AM, using the “remind me” days you set on each bill, EMI, card and document.</Text>
          </View>
          <Switch value={s.notificationsEnabled} onValueChange={toggleReminders} trackColor={{ true: colors.primary }} />
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Weekly summary</Text>
            <Text style={styles.itemSub}>Sunday evening: how much you spent this week vs last week.</Text>
          </View>
          <Switch value={s.weeklySummary !== false} onValueChange={(v) => updateSettings({ weeklySummary: v })} trackColor={{ true: colors.primary }} accessibilityLabel="Weekly summary" />
        </Row>
        {notificationsSupported ? (
          <Button title="Schedule reminders now" variant="secondary" icon="notifications-outline" onPress={testReminders} />
        ) : (
          <Text style={styles.hint}>Phone notifications work in the installed app. In this preview, reminders show on the Actions tab.</Text>
        )}
      </Card>

      <SectionTitle title={t('Google account & backup')} />
      <Card>
        <GoogleBackupPanel />
      </Card>

      <SectionTitle title={t('This phone is used by')} />
      <Card>
        <ChipRow>
          {data.members.map((m) => (
            <Chip key={m.id} label={m.name} icon="person-outline" selected={s.currentMemberId === m.id} onPress={() => updateSettings({ currentMemberId: m.id })} />
          ))}
        </ChipRow>
        <Text style={styles.hint}>New spends are counted against this person’s allowance.</Text>
      </Card>

      <SectionTitle title={t('More')} />
      <Card>
        <ListItem icon="diamond-outline" iconColor={colors.accent} title={s.premium ? 'Premium – active' : 'FamilyFin Premium'} subtitle={s.premium ? 'Thank you!' : `Lifetime · ${premiumPrice(s.currencyCode).label}`} onPress={() => router.push('/premium')} />
        <ListItem icon="pricetags-outline" title={t('Categories')} subtitle="Add your own categories" onPress={() => router.push('/categories')} />
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>I always pay card bills in full</Text>
            <Text style={styles.itemSub}>Turn off if you carry a card balance – then the app won’t suggest paying by card.</Text>
          </View>
          <Switch value={s.payCardsInFull} onValueChange={(v) => updateSettings({ payCardsInFull: v })} trackColor={{ true: colors.primary }} />
        </Row>
      </Card>

      <SectionTitle title={t('Your data')} />
      <Card>
        <Text style={styles.itemSub}>
          {data.transactions.length} transactions · {data.accounts.length} accounts. Stored on this phone{data.google?.lastBackup ? ' and in your Google Drive backup' : ''}.
        </Text>
        <Button title="Export transactions (CSV)" variant="secondary" icon="download-outline" onPress={() => share('FamilyFin transactions', transactionsToCsv(data))} />
        <Button title="Share backup file (JSON)" variant="secondary" icon="share-outline" onPress={() => share('FamilyFin backup', JSON.stringify({ ...data, google: undefined }))} />
        <Button title="Load demo data" variant="secondary" icon="play-outline" onPress={() => withPin('demo')} />
        <Button title="Erase all data" variant="danger" icon="trash-outline" onPress={() => withPin('erase')} />
        <Text style={styles.hint}>Both replace everything in the app, so they ask for your app PIN.</Text>
      </Card>
      <Modal visible={!!pinFor} animationType="slide" onRequestClose={() => setPinFor(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
          {pinFor ? <PinPad title={pinFor === 'erase' ? 'Enter your PIN to erase all data' : 'Enter your PIN to replace your data'} onUnlock={afterPin} /> : null}
          <Button title="Cancel" variant="secondary" onPress={() => setPinFor(null)} />
        </View>
      </Modal>
      <Text style={[styles.hint, { textAlign: 'center' }]}>FamilyFin v1.2</Text>
    </Screen>
  );
}
