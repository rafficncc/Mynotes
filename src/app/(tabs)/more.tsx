import { router, type Href } from 'expo-router';
import { Card, ListItem, Screen } from '../../components/ui';
import { colors } from '../../theme';

const ITEMS: { icon: string; title: string; subtitle: string; href: Href; color: string }[] = [
  { icon: 'wallet-outline', title: 'Accounts', subtitle: 'Savings, investments, credit cards, loans, real estate', href: '/accounts', color: colors.primary },
  { icon: 'receipt-outline', title: 'Bills & reminders', subtitle: 'Mobile, internet, utilities, taxes, fines', href: '/bills', color: colors.warning },
  { icon: 'calendar-number-outline', title: 'EMIs & instalments', subtitle: 'Card EMIs, loan EMIs and what is left to pay', href: '/emis', color: '#4E342E' },
  { icon: 'id-card-outline', title: 'Document expiry', subtitle: 'Passport, visa, Emirates ID, licence, Aadhaar…', href: '/documents', color: colors.danger },
  { icon: 'pie-chart-outline', title: 'Monthly budgets', subtitle: 'Set limits per category and get early warnings', href: '/budgets', color: colors.accent },
  { icon: 'storefront-outline', title: 'Price book', subtitle: 'Compare prices across shops – buy cheaper', href: '/prices', color: '#00838F' },
  { icon: 'flag-outline', title: 'Savings goals', subtitle: 'Vacation, emergency fund, kids education…', href: '/goals', color: colors.success },
  { icon: 'people-outline', title: 'Family & allowances', subtitle: 'Budget per member and family group', href: '/family', color: colors.info },
  { icon: 'pricetags-outline', title: 'Categories', subtitle: 'Add your own spending categories', href: '/categories', color: '#AD1457' },
  { icon: 'diamond-outline', title: 'Premium', subtitle: 'Unlimited accounts & cards – one-time payment', href: '/premium', color: colors.accent },
  { icon: 'options-outline', title: 'Cut-back simulator', subtitle: 'What if we spend 20% less on dining?', href: '/simulator', color: '#7B1FA2' },
  { icon: 'settings-outline', title: 'Settings & export', subtitle: 'Spending cycle, currency, reminders, Google backup', href: '/settings', color: colors.muted },
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
