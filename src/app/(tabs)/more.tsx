import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GradientBg, HeroCard } from '../../components/GradientBg';
import { Icon, Row, Screen, SectionTitle } from '../../components/ui';
import { t } from '../../i18n';
import { colors } from '../../theme';
import { PREMIUM_ROUTES } from '../../logic/premium';
import { useStore } from '../../store/useStore';

type Item = { icon: string; title: string; subtitle: string; href: Href; color: string };

// Built at render time so a language change shows up straight away.
const groups = (): [string, Item[]][] => [
  [
    t('Money'),
    [
      { icon: 'wallet-outline', title: t('Accounts'), subtitle: 'Savings, investments, credit cards, loans, real estate', href: '/accounts', color: colors.primary },
      { icon: 'people-outline', title: t('Lend & borrow'), subtitle: 'Who owes whom, split bills', href: '/people', color: colors.info },
      { icon: 'paper-plane-outline', title: t('Money sent home'), subtitle: 'Remittances, rates and fees', href: '/remittance', color: colors.info },
      { icon: 'flag-outline', title: t('Events & trips'), subtitle: 'Budget for a wedding, trip or festival', href: '/events', color: colors.accent },
      { icon: 'trending-up-outline', title: t('Investments'), subtitle: 'Fixed deposits, SIPs, gold', href: '/investments', color: colors.success },
      { icon: 'trending-down-outline', title: t('Debt payoff planner'), subtitle: 'Which debt to clear first, debt-free date', href: '/debts', color: colors.danger },
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
    t('Family & settings'),
    [
      { icon: 'people-circle-outline', title: t('Family & allowances'), subtitle: 'Budget per member and family group', href: '/family', color: colors.info },
      { icon: 'finger-print-outline', title: t('Security & privacy'), subtitle: 'App lock, hide amounts', href: '/security', color: colors.text },
      { icon: 'pricetags-outline', title: t('Categories'), subtitle: 'Add your own spending categories', href: '/categories', color: '#AD1457' },
      { icon: 'trash-outline', title: t('Recycle bin'), subtitle: 'Restore deleted transactions', href: '/trash', color: colors.muted },
      { icon: 'diamond-outline', title: t('Premium'), subtitle: 'Yearly or lifetime · 7-day free trial', href: '/premium', color: colors.accent },
      { icon: 'settings-outline', title: t('Settings & export'), subtitle: 'Cycle, currency, language, theme, reminders, backup', href: '/settings', color: colors.muted },
    ],
  ],
];

// Section accents, matching the Home tile colours.
const ACCENTS = ['#14915F', '#C9671C', '#2F6FC4', '#6E48C2', '#C2414F'];

export default function More() {
  const premium = useStore((st) => st.settings.premium);
  const crown = (i: Item) => !premium && PREMIUM_ROUTES.includes(i.href as string);
  return (
    <Screen>
      {/* Family safety net: the Money Vault gets its own spot at the top */}
      <SectionTitle title={t('Family safety net')} />
      <Pressable onPress={() => router.push('/vault')} accessibilityRole="button" accessibilityLabel="Money vault. Everything your family needs if something happens to you">
        <HeroCard id="vaultbg" style={{ gap: 10 }}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock-closed" size={24} color="#FFD978" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                {t('Money vault')}
                {!premium && PREMIUM_ROUTES.includes('/vault') ? '  👑' : ''}
              </Text>
              <Text style={{ color: '#ffffffb3', fontSize: 13 }}>Don’t leave your money unattended</Text>
            </View>
          </Row>
          <Text style={{ color: '#ffffffdd', fontSize: 13, lineHeight: 19 }}>
            Bank accounts, policies, lockers, nominees and who to call, all in one place, so your family knows exactly what to do if something happens to you.
          </Text>
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: '#1B1F5E', fontWeight: '800', fontSize: 13 }}>Open vault ›</Text>
          </View>
        </HeroCard>
      </Pressable>

      {groups().map(([title, items], gi) => {
        const accent = ACCENTS[gi % ACCENTS.length];
        return (
          <View key={title} style={{ gap: 8 }}>
            <Row style={{ gap: 8, marginTop: 6 }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: accent }} />
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted }}>{title.toUpperCase()}</Text>
            </Row>
            <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {items.map((i, ii) => (
                <Pressable
                  key={i.href as string}
                  onPress={() => router.push(i.href)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i.title}, ${i.subtitle}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: ii ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    <GradientBg id={`more${gi}-${ii}`} colors={[accent, accent + 'B3']} />
                    <Icon name={i.icon} size={19} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                      {i.title}
                      {crown(i) ? '  👑' : ''}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                      {i.subtitle}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
