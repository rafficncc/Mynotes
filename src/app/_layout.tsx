import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { DialogHost } from '../components/Dialog';
import { syncReminders } from '../services/notifications';
import { useAppData, useMoney } from '../store/hooks';
import { useHydrated } from '../store/useHydrated';
import { colors } from '../theme';

/** Re-schedules phone reminders shortly after any change to bills, EMIs, cards or documents. */
function ReminderSync() {
  const data = useAppData();
  const { money } = useMoney();
  const hydrated = useHydrated();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      syncReminders(data, money).catch(() => undefined);
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hydrated, data.bills, data.emis, data.documents, data.accounts, data.transactions, data.settings.notificationsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const screens: [string, string, boolean?][] = [
  ['accounts', 'Accounts'],
  ['budgets', 'Budgets'],
  ['prices', 'Price book'],
  ['goals', 'Savings goals'],
  ['family', 'Family & allowances'],
  ['bills', 'Bills & reminders'],
  ['emis', 'EMIs & instalments'],
  ['documents', 'Document expiry'],
  ['categories', 'Categories'],
  ['simulator', 'Cut-back simulator'],
  ['settings', 'Settings'],
  ['premium', 'FamilyFin Premium', true],
];

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <ReminderSync />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add transaction' }} />
        <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'Account' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        {screens.map(([name, title, modal]) => (
          <Stack.Screen key={name} name={name} options={{ title, presentation: modal ? 'modal' : undefined }} />
        ))}
      </Stack>
      <DialogHost />
    </>
  );
}
