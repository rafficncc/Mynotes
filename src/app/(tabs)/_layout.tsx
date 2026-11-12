import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
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
      <Tabs.Screen name="index" options={tab('home-outline', 'Home')} />
      <Tabs.Screen name="transactions" options={tab('list-outline', 'Transactions')} />
      <Tabs.Screen
        name="actions"
        options={{ ...tab('checkbox-outline', 'Actions'), tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tabs.Screen name="insights" options={tab('bulb-outline', 'Insights')} />
      <Tabs.Screen name="cards" options={tab('card-outline', 'Cards')} />
      <Tabs.Screen name="more" options={tab('grid-outline', 'More')} />
    </Tabs>
  );
}
