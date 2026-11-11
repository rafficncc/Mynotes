import { Redirect } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { Icon } from '../../components/ui';
import { useHydrated } from '../../store/useHydrated';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme';

const tab = (icon: string, title: string) => ({
  title,
  tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <Icon name={icon} color={String(color)} size={size} />,
});

export default function TabsLayout() {
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.settings.onboarded);
  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/welcome" />;
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
      <Tabs.Screen name="insights" options={tab('bulb-outline', 'Insights')} />
      <Tabs.Screen name="cards" options={tab('card-outline', 'Smart Card')} />
      <Tabs.Screen name="more" options={tab('grid-outline', 'More')} />
    </Tabs>
  );
}
