import { router, type Href } from 'expo-router';
import { Card, ListItem, Screen, SectionTitle } from '../../components/ui';
import { t } from '../../i18n';
import { colors } from '../../theme';

type Item = { icon: string; title: string; subtitle: string; href: Href; color: string };

// Built at render time so a language change shows up straight away.
const groups = (): [string, Item[]][] => [
  [
    t('Quick add'),
    [
      { icon: 'scan-outline', title: t('Scan a bill'), subtitle: 'Photo → expense, read on your phone', href: '/scan', color: colors.primary },
      { icon: 'mic-outline', title: t('Voice entry'), subtitle: '“200 cash milk”', href: '/voice', color: colors.primary },
    ],
  ],
  [
    t('Money'),
    [
      { icon: 'wallet-outline', title: t('Accounts'), subtitle: 'Savings, investments, credit cards, loans, real estate', href: '/accounts', color: colors.primary },
      { icon: 'people-outline', title: t('Lend & borrow'), subtitle: 'Who owes whom, split bills', href: '/people', color: colors.info },
      { icon: 'paper-plane-outline', title: t('Money sent home'), subtitle: 'Remittances, rates and fees', href: '/remittance', color: colors.info },
      { icon: 'flag-outline', title: t('Events & trips'), subtitle: 'Budget for a wedding, trip or festival', href: '/events', color: colors.accent },
      { icon: 'trending-up-outline', title: t('Investments'), subtitle: 'Fixed deposits, SIPs, gold', href: '/investments', color: colors.success },
      { icon: 'calculator-outline', title: t('Loan prepayment'), subtitle: 'How much interest a prepayment saves', href: '/prepay', color: colors.warning },
    ],
  ],
  [
    t('Bills & reminders'),
    [
      { icon: 'receipt-outline', title: t('Bills & reminders'), subtitle: 'Mobile, internet, utilities, taxes, fines', href: '/bills', color: colors.warning },
      { icon: 'calendar-number-outline', title: t('EMIs & instalments'), subtitle: 'Card EMIs, loan EMIs and what is left to pay', href: '/emis', color: '#8D6E63' },
      { icon: 'shield-checkmark-outline', title: t('Insurance policies'), subtitle: 'Premiums, cover, nominees, renewals', href: '/policies', color: colors.info },
      { icon: 'id-card-outline', title: t('Document expiry'), subtitle: 'Passport, visa, Emirates ID, licence, Aadhaar…', href: '/documents', color: colors.danger },
      { icon: 'car-outline', title: t('Vehicles'), subtitle: 'Mileage, service, insurance and PUC', href: '/vehicles', color: colors.info },
      { icon: 'medkit-outline', title: t('Medical claims'), subtitle: 'Claims and medical spending per person', href: '/claims', color: colors.danger },
    ],
  ],
  [
    t('Plan & save'),
    [
      { icon: 'pie-chart-outline', title: t('Monthly budgets'), subtitle: 'Limits per category with early warnings', href: '/budgets', color: colors.accent },
      { icon: 'flag-outline', title: t('Savings goals'), subtitle: 'With automatic monthly saving', href: '/goals', color: colors.success },
      { icon: 'trophy-outline', title: t('Challenges & badges'), subtitle: 'No-spend weekend, 52-week challenge, streaks', href: '/challenges', color: colors.accent },
      { icon: 'options-outline', title: t('Cut-back simulator'), subtitle: 'What if we spend 20% less on dining?', href: '/simulator', color: '#7B1FA2' },
      { icon: 'storefront-outline', title: t('Price book'), subtitle: 'Compare prices across shops – buy cheaper', href: '/prices', color: '#00838F' },
    ],
  ],
  [
    t('Reports'),
    [
      { icon: 'bar-chart-outline', title: t('Reports'), subtitle: 'Any date range, month vs month, PDF', href: '/reports', color: colors.primary },
      { icon: 'sparkles-outline', title: t('Year in review'), subtitle: 'Your family’s year in one card', href: '/year', color: colors.accent },
    ],
  ],
  [
    t('Family & app'),
    [
      { icon: 'people-circle-outline', title: t('Family & allowances'), subtitle: 'Budget per member and family group', href: '/family', color: colors.info },
      { icon: 'lock-closed-outline', title: t('Money vault'), subtitle: 'Nominees, contacts, what to do in an emergency', href: '/vault', color: colors.text },
      { icon: 'finger-print-outline', title: t('Security & privacy'), subtitle: 'App lock, hide amounts', href: '/security', color: colors.text },
      { icon: 'pricetags-outline', title: t('Categories'), subtitle: 'Add your own spending categories', href: '/categories', color: '#AD1457' },
      { icon: 'trash-outline', title: t('Recycle bin'), subtitle: 'Restore deleted transactions', href: '/trash', color: colors.muted },
      { icon: 'diamond-outline', title: t('Premium'), subtitle: 'Unlimited accounts & cards – one-time payment', href: '/premium', color: colors.accent },
      { icon: 'settings-outline', title: t('Settings & export'), subtitle: 'Cycle, currency, language, theme, reminders, backup', href: '/settings', color: colors.muted },
    ],
  ],
];

export default function More() {
  return (
    <Screen>
      {groups().map(([title, items]) => (
        <Card key={title} style={{ gap: 0 }}>
          <SectionTitle title={title} />
          {items.map((i) => (
            <ListItem key={i.href as string} icon={i.icon} iconColor={i.color} title={i.title} subtitle={i.subtitle} onPress={() => router.push(i.href)} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}
