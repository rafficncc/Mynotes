import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GradientBg } from '../../components/GradientBg';
import { PremiumBadge } from '../../components/PremiumGate';
import { Icon, Row, Screen } from '../../components/ui';
import { t } from '../../i18n';
import { colors } from '../../theme';
import { PREMIUM_ROUTES } from '../../logic/premium';
import { useStore } from '../../store/useStore';
import { useAppData } from '../../store/hooks';
import { readiness } from '../../logic/vault';
import { safetyNet } from '../../logic/insights';
import { formatDate } from '../../logic/dates';

type Item = { icon: string; title: string; subtitle: string; href: Href; color: string };

// Built at render time so a language change shows up straight away.
const groups = (): [string, Item[]][] => [
  [
    t('Money'),
    [
      { icon: 'wallet-outline', title: t('Accounts'), subtitle: 'Savings, investments, credit cards, loans, real estate', href: '/accounts', color: colors.primary },
      { icon: 'people-outline', title: t('Lend & borrow'), subtitle: 'Who owes whom, split bills', href: '/people', color: colors.info },
      { icon: 'paper-plane-outline', title: t('Money sent home'), subtitle: 'Money you send to family in another country', href: '/remittance', color: colors.info },
      { icon: 'flag-outline', title: t('Events & trips'), subtitle: 'Budget for a wedding, trip or festival', href: '/events', color: colors.accent },
      { icon: 'trending-up-outline', title: t('Investments'), subtitle: 'Mutual funds, SIPs, stocks, FD, PPF, EPF, NPS, gold', href: '/investments', color: colors.success },
      { icon: 'trending-down-outline', title: t('Debt payoff planner'), subtitle: 'Which debt to clear first, debt-free date', href: '/debts', color: colors.danger },
      { icon: 'calculator-outline', title: t('Loan prepayment'), subtitle: 'Part payment on a loan: what it saves, record it', href: '/prepay', color: colors.warning },
    ],
  ],
  [
    t('Bills & reminders'),
    [
      { icon: 'receipt-outline', title: t('Bills & reminders'), subtitle: 'Mobile, internet, utilities, taxes, fines', href: '/bills', color: colors.warning },
      { icon: 'calendar-number-outline', title: t('EMIs & instalments'), subtitle: 'Card EMIs, loan EMIs and what is left to pay', href: '/emis', color: '#8D6E63' },
      { icon: 'shield-checkmark-outline', title: t('Insurance policies'), subtitle: 'Premiums, cover, nominees, renewals', href: '/policies', color: colors.info },
      { icon: 'id-card-outline', title: t('Document expiry'), subtitle: 'Passport, visa, Emirates ID, licence, Aadhaar…', href: '/documents', color: colors.danger },
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
const GOLD = '#FFD978';
const VAULT_POINTS = [
  ['business-outline', 'Banks & lockers'],
  ['shield-checkmark-outline', 'Policies & nominees'],
  ['call-outline', 'Who to call'],
  ['document-lock-outline', 'Locked PDF to share'],
] as const;

const ACCENTS = ['#14915F', '#C9671C', '#2F6FC4', '#6E48C2', '#C2414F'];

export default function More() {
  const premium = useStore((st) => st.settings.premium);
  const data = useAppData();
  const ready = useMemo(() => readiness(data), [data]);
  const shared = data.settings.vaultShared;
  const ef = useMemo(() => safetyNet(data).emergency, [data]);
  const locked = (i: Item) => !premium && PREMIUM_ROUTES.includes(i.href as string);
  return (
    <Screen>
      {/* Family safety net: the Money Vault is FamilyFin's signature feature, so it leads the page */}
      <Pressable onPress={() => router.push('/vault')} accessibilityRole="button" accessibilityLabel={`Money vault, ${ready.percent}% ready. Everything your family needs if something happens to you`}>
        <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#FFD97866' }}>
          <GradientBg id="vaultbg" colors={['#141A4A', '#3B2275', '#7A5A12']} />
          <View pointerEvents="none" style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#FFD97814', top: -90, right: -80 }} />
          <View pointerEvents="none" style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#ffffff0a', bottom: -50, left: -40 }} />
          <View style={{ padding: 18, gap: 14 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: '#FFD97833', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>★ FAMILY SAFETY NET</Text>
              </View>
              {!premium ? <PremiumBadge id="vaultbadge" /> : null}
            </Row>

            <Row style={{ gap: 14 }}>
              {/* glowing lock */}
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFD9781f', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFD97840', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: GOLD }}>
                  <Icon name="shield-checkmark" size={28} color={GOLD} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.3 }}>{t('Money vault')}</Text>
                <Text style={{ color: '#ffffffcc', fontSize: 13, lineHeight: 18 }}>If something happens to you, will your family find all your money?</Text>
              </View>
            </Row>

            {/* how ready it is */}
            <View style={{ backgroundColor: '#00000026', borderRadius: 14, padding: 12, gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{ready.percent ? `Your vault is ${ready.percent}% ready` : 'Not started yet'}</Text>
                <Text style={{ color: '#ffffffb3', fontSize: 12 }}>
                  {ready.done} of {ready.total} topics
                </Text>
              </Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: '#ffffff26', overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(3, ready.percent)}%`, height: '100%', borderRadius: 4, backgroundColor: GOLD }} />
              </View>
              <Text style={{ color: shared ? '#7EE3B5' : '#FF9E8A', fontSize: 12, fontWeight: '700' }}>
                {shared ? `✓ Last shared with ${shared.with} on ${formatDate(shared.at.slice(0, 10))}` : '! Not shared with your family yet'}
              </Text>
            </View>

            {/* what goes in it */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {VAULT_POINTS.map(([icon, label]) => (
                <Row key={label} style={{ gap: 6, flexBasis: '47%', flexGrow: 1, backgroundColor: '#ffffff14', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Icon name={icon} size={15} color={GOLD} />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {label}
                  </Text>
                </Row>
              ))}
            </View>

            <View style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#141A4A', fontWeight: '900', fontSize: 15 }}>{ready.percent ? 'Open your vault  ›' : 'Start your vault in 5 minutes  ›'}</Text>
            </View>
            <Text style={{ color: '#ffffff99', fontSize: 11, textAlign: 'center' }}>Don’t leave your money unattended. Keep your loved ones informed.</Text>
          </View>
        </View>
      </Pressable>

      {/* Emergency fund: free, part of the family safety net */}
      <Pressable onPress={() => router.push('/emergency')} accessibilityRole="button" accessibilityLabel="Emergency fund" style={{ borderRadius: 18, overflow: 'hidden' }}>
        <GradientBg id="efmore" colors={['#0B5450', '#14918B']} />
        <Row style={{ gap: 12, padding: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="umbrella" size={22} color="#7FE0D8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Emergency fund</Text>
            <Text style={{ color: '#ffffffcc', fontSize: 12 }}>{ef.amount ? `${ef.months.toFixed(1)} of ${ef.goal} months covered · kept untouched` : 'Set aside money for job loss or medical emergencies'}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#fff" />
        </Row>
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
                    <Row style={{ gap: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                        {i.title}
                      </Text>
                      {locked(i) ? <PremiumBadge id={`pb${gi}-${ii}`} /> : null}
                    </Row>
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
