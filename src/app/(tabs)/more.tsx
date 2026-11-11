import { router, type Href } from 'expo-router';
import { Card, ListItem, Screen } from '../../components/ui';
import { colors } from '../../theme';

const ITEMS: { icon: string; title: string; subtitle: string; href: Href; color: string }[] = [
  { icon: 'wallet-outline', title: 'Accounts & cards', subtitle: 'Cash, bank, debit/credit cards, UPI wallets', href: '/accounts', color: colors.primary },
  { icon: 'pie-chart-outline', title: 'Monthly budgets', subtitle: 'Set limits per category and get early warnings', href: '/budgets', color: colors.accent },
  { icon: 'storefront-outline', title: 'Price book', subtitle: 'Compare prices across shops – buy cheaper', href: '/prices', color: '#00838F' },
  { icon: 'receipt-outline', title: 'Bills & subscriptions', subtitle: 'Reminders and forgotten subscriptions', href: '/bills', color: colors.warning },
  { icon: 'flag-outline', title: 'Savings goals', subtitle: 'Vacation, emergency fund, kids education…', href: '/goals', color: colors.success },
  { icon: 'people-outline', title: 'Family members', subtitle: 'See who spends on what', href: '/family', color: colors.info },
  { icon: 'options-outline', title: 'Cut-back simulator', subtitle: 'What if we spend 20% less on dining?', href: '/simulator', color: '#7B1FA2' },
  { icon: 'settings-outline', title: 'Settings & export', subtitle: 'Currency, CSV export, demo data, reset', href: '/settings', color: colors.muted },
];

export default function More() {
  return (
    <Screen>
      <Card>
        {ITEMS.map((i) => (
          <ListItem key={i.title} icon={i.icon} iconColor={i.color} title={i.title} subtitle={i.subtitle} onPress={() => router.push(i.href)} />
        ))}
      </Card>
    </Screen>
  );
}
