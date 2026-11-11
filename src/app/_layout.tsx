import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
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
        <Stack.Screen name="accounts" options={{ title: 'Accounts & cards' }} />
        <Stack.Screen name="budgets" options={{ title: 'Monthly budgets' }} />
        <Stack.Screen name="prices" options={{ title: 'Price book' }} />
        <Stack.Screen name="goals" options={{ title: 'Savings goals' }} />
        <Stack.Screen name="family" options={{ title: 'Family members' }} />
        <Stack.Screen name="bills" options={{ title: 'Bills & subscriptions' }} />
        <Stack.Screen name="simulator" options={{ title: 'Cut-back simulator' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
