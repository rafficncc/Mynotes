import { ownedPlan } from '../services/purchases';
import * as QuickActions from 'expo-quick-actions';
import { t } from '../i18n';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { DialogHost } from '../components/Dialog';
import { LockGate } from '../components/LockScreen';
import { toast, ToastHost } from '../components/Toast';
import { dueContributions } from '../logic/motivation';
import { dueSipTransfers } from '../logic/payments';
import { deletePhoto } from '../services/billPhotos';
import { syncReminders } from '../services/notifications';
import { useAppData, useMoney } from '../store/hooks';
import { useHydrated } from '../store/useHydrated';
import { useStore } from '../store/useStore';
import { colors, isDark } from '../theme';

const base = isDark ? DarkTheme : DefaultTheme;
const navTheme = { ...base, colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.card, text: colors.text, border: colors.border } };

/** Re-schedules phone reminders shortly after any change to bills, EMIs, cards or documents. */
/** Runs once after data loads: empties old recycle-bin items. */
function StartupTasks() {
  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated) return;
    QuickActions.setItems([
      { id: 'voice', title: 'Voice expense', icon: Platform.OS === 'ios' ? 'symbol:mic' : null, params: { href: '/voice' } },
      { id: 'scan', title: t('Scan a bill'), icon: Platform.OS === 'ios' ? 'symbol:doc.viewfinder' : null, params: { href: '/scan' } },
      { id: 'add', title: 'Add expense', icon: Platform.OS === 'ios' ? 'add' : null, params: { href: '/add?type=expense' } },
    ]).catch(() => undefined);
    // Web preview only (flag set by the preview build script): always open with Premium on, even with older saved data.
    if (process.env.EXPO_PUBLIC_PREVIEW_PREMIUM === '1' && !useStore.getState().settings.premium) useStore.getState().updateSettings({ premium: true });
    // Yearly plans end when not renewed; a reinstall gets Premium back from the store.
    ownedPlan().then((owned) => {
      const st = useStore.getState();
      if (owned === 'none' && st.settings.premiumPlan === 'yearly') st.updateSettings({ premium: false, premiumPlan: undefined });
      else if ((owned === 'lifetime' || owned === 'yearly') && !st.settings.premium) st.updateSettings({ premium: true, premiumPlan: owned });
    });
    const cutoff = Date.now() - 30 * 86400000;
    useStore.getState().trash.filter((t) => new Date(t.deletedAt ?? 0).getTime() < cutoff).forEach((t) => deletePhoto(t.photoUri));
    useStore.getState().purgeTrash();
    // SIP debits that fell due: bank → fund transfers, so both balances follow
    for (const fund of useStore.getState().accounts) {
      const due = dueSipTransfers(fund, useStore.getState().accounts, new Date());
      if (!due.length) continue;
      due.forEach((t) => useStore.getState().addTransaction(t));
      useStore.getState().updateAccount(fund.id, { sipLast: due[due.length - 1].date });
      toast(`Recorded ${due.length > 1 ? `${due.length} SIP debits` : 'this month’s SIP'} for ${fund.name}`);
    }
    // Automatic monthly goal contributions that fell due since the last app open
    const st = useStore.getState();
    for (const g of st.goals) {
      const dates = dueContributions(g, new Date());
      if (!dates.length) continue;
      for (const date of dates) {
        if (g.fromAccountId && g.toAccountId) st.addTransaction({ type: 'transfer', amount: g.autoAmount!, date, accountId: g.fromAccountId, toAccountId: g.toAccountId, note: `Auto-save: ${g.name}` });
      }
      st.updateGoal(g.id, { saved: Math.min(g.target, g.saved + g.autoAmount! * dates.length), lastAuto: dates[dates.length - 1] });
      toast(`Added ${dates.length > 1 ? `${dates.length} monthly savings` : 'this month’s saving'} to “${g.name}”`);
    }
  }, [hydrated]);
  return null;
}

function ReminderSync() {
  const data = useAppData();
  const { money } = useMoney();
  const hydrated = useHydrated();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    QuickActions.setItems([
      { id: 'voice', title: 'Voice expense', icon: Platform.OS === 'ios' ? 'symbol:mic' : null, params: { href: '/voice' } },
      { id: 'scan', title: t('Scan a bill'), icon: Platform.OS === 'ios' ? 'symbol:doc.viewfinder' : null, params: { href: '/scan' } },
      { id: 'add', title: 'Add expense', icon: Platform.OS === 'ios' ? 'add' : null, params: { href: '/add?type=expense' } },
    ]).catch(() => undefined);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      syncReminders(data, money).catch(() => undefined);
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hydrated, data.bills, data.emis, data.documents, data.accounts, data.transactions, data.settings.notificationsEnabled, data.settings.weeklySummary, data.settings.reminderHour, data.policies, data.vehicles]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const screens: [string, string, boolean?][] = [
  ['accounts', t('Accounts')],
  ['budgets', 'Budgets'],
  ['goals', t('Savings goals')],
  ['family', t('Family & allowances')],
  ['bills', t('Bills & reminders')],
  ['emis', t('EMIs & instalments')],
  ['documents', t('Document expiry')],
  ['categories', t('Categories')],
  ['simulator', t('Cut-back simulator')],
  ['settings', 'Settings'],
  ['premium', 'FamilyFin Premium', true],
  ['trash', t('Recycle bin')],
  ['people', t('Lend & borrow')],
  ['person', t('Lend & borrow')],
  ['remittance', t('Money sent home')],
  ['events', t('Events & trips')],
  ['policies', t('Insurance policies')],
  ['investments', t('Investments')],
  ['vehicles', t('Vehicles')],
  ['claims', t('Medical claims')],
  ['vault', t('Money vault')],
  ['prepay', t('Loan prepayment')],
  ['debts', t('Debt payoff planner')],
  ['reports', t('Reports')],
  ['year', t('Year in review')],
  ['challenges', t('Challenges & badges')],
  ['voice', t('Voice entry')],
  ['setup', 'FamilyFin'],
  ['security', t('Security & privacy')],
];

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ReminderSync />
      <StartupTasks />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: t('Add transaction') }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal', title: t('Scan a bill') }} />
        <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'Account' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        {screens.map(([name, title, modal]) => (
          <Stack.Screen key={name} name={name} options={{ title, presentation: modal ? 'modal' : undefined }} />
        ))}
      </Stack>
      <ToastHost />
      <LockGate />
      <DialogHost />
    </ThemeProvider>
  );
}
