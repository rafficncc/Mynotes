import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { GradientBg } from './GradientBg';
import { FREE_MONTHLY, countUse, usesLeft, type UseKind } from '../logic/premium';
import { useStore } from '../store/useStore';
import { colors } from '../theme';
import { ask } from './Dialog';
import { Button, Card, Icon, Screen, styles } from './ui';

const GOLD_GRADIENT = ['#FFE7A0', '#F5B841', '#D98E04'];

/** Small gold "PREMIUM" pill with a diamond, shown next to paid features. */
export function PremiumBadge({ id = 'pbadge' }: { id?: string }) {
  return (
    <View accessibilityLabel="Premium" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2 }}>
      <GradientBg id={id} colors={GOLD_GRADIENT} />
      <Icon name="diamond" size={10} color="#5A3E00" />
      <Text style={{ color: '#5A3E00', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>PREMIUM</Text>
    </View>
  );
}

/** Wraps a screen so free users see what it offers and how to unlock it. */
export function premiumOnly<P extends object>(Screen_: ComponentType<P>, title: string, text: string) {
  return function PremiumOnly(props: P) {
    const premium = useStore((s) => s.settings.premium);
    if (premium) return <Screen_ {...props} />;
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <View accessibilityLabel="Premium feature" style={{ width: 76, height: 76, borderRadius: 38, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <GradientBg id="gatebadge" colors={GOLD_GRADIENT} />
            <Icon name="diamond" size={36} color="#5A3E00" />
          </View>
          <PremiumBadge />
          <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>{title}</Text>
          <Text style={[styles.itemSub, { textAlign: 'center' }]}>{text}</Text>
          <Text style={[styles.hint, { textAlign: 'center' }]}>Part of FamilyFin Premium. Try it free for 7 days with the yearly plan.</Text>
        </Card>
        <Button title="See Premium" icon="diamond-outline" onPress={() => router.push('/premium')} />
        <Button title="Not now" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  };
}

/**
 * Uses one free scan or voice entry this month. Returns false (and offers Premium) when none are left.
 * Premium users always get true.
 */
export function takeFreeUse(kind: UseKind): boolean {
  const { settings, updateSettings } = useStore.getState();
  if (settings.premium) return true;
  const now = new Date();
  if (usesLeft(settings.usage, kind, now) <= 0) {
    ask(`You've used your ${FREE_MONTHLY} free ${kind === 'scans' ? 'bill scans' : 'voice entries'} this month`, 'Get Premium for unlimited use, or add this one by hand. Free uses come back next month.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'See Premium', onPress: () => router.push('/premium') },
    ]);
    return false;
  }
  updateSettings({ usage: countUse(settings.usage, kind, now) });
  return true;
}

/** "3 of 10 free scans left this month" line for free users. */
export function FreeUsesLeft({ kind }: { kind: UseKind }) {
  const settings = useStore((s) => s.settings);
  if (settings.premium) return null;
  const left = usesLeft(settings.usage, kind, new Date());
  return (
    <Text style={[styles.hint, { textAlign: 'center', color: left ? colors.muted : colors.danger }]}>
      <Icon name="diamond-outline" size={12} color={colors.accent} /> {left} of {FREE_MONTHLY} free {kind === 'scans' ? 'scans' : 'voice entries'} left this month
    </Text>
  );
}
