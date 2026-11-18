import { Redirect } from 'expo-router';
import { t } from '../../i18n';
import { Tabs } from 'expo-router/js-tabs';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { useMemo } from 'react';
import type { ColorValue } from 'react-native';
import { Icon } from '../../components/ui';
import { generateActions, pendingCount } from '../../logic/actions';
import { useAppData } from '../../store/hooks';
import { useHydrated } from '../../store/useHydrated';
import { colors } from '../../theme';

const tab = (icon: string, title: string) => ({
  title,
  tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <Icon name={icon} color={String(color)} size={size} />,
});

export default function TabsLayout() {
  // App-icon shortcuts (long-press the icon) open these screens.
  useQuickActionRouting();
  const hydrated = useHydrated();
  const data = useAppData();
  const pending = useMemo(() => pendingCount(generateActions(data)), [data]);
  if (!hydrated) return null;
  if (!data.settings.onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={tab('home-outline', t('Home'))} />
      <Tabs.Screen name="transactions" options={tab('list-outline', t('Transactions'))} />
      <Tabs.Screen
        name="actions"
        options={{ ...tab('checkbox-outline', t('Actions')), tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tabs.Screen name="insights" options={tab('bulb-outline', t('Insights'))} />
      <Tabs.Screen name="cards" options={tab('card-outline', t('Cards'))} />
      <Tabs.Screen name="more" options={tab('grid-outline', t('More'))} />
    </Tabs>
  );
}
