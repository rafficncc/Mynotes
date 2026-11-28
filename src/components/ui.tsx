import { Ionicons } from '@expo/vector-icons';
import { useId, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, severityStyle, spacing } from '../theme';
import type { Insight } from '../logic/types';
import { GradientBg, HERO } from './GradientBg';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: string; size?: number; color?: string }) {
  return <Ionicons name={name as IconName} size={size} color={color} />;
}

export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      // Centred, readable width on tablets; full width on phones.
      contentContainerStyle={{ padding: padded ? spacing.lg : 0, paddingBottom: 100, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** `gradient` draws the app's hero gradient behind the card (use white text and `light` Stats inside). */
export function Card({ children, style, gradient }: { children: ReactNode; style?: StyleProp<ViewStyle>; gradient?: boolean }) {
  const gid = `card${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!gradient) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <View style={[styles.card, { overflow: 'hidden', borderWidth: 0, backgroundColor: HERO[0] }, style]}>
      <GradientBg id={gid} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff10', top: -70, right: -60 }} />
      {children}
    </View>
  );
}

/** Bright versions of the status colours for text on the gradient. */
export const lightTone = (c?: string) => (c === colors.success ? '#7EE3B5' : c === colors.danger ? '#FF9E8A' : c === colors.warning ? '#FFD978' : c === colors.info ? '#9CC3FF' : '#fff');

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.primary }} />
        <Text style={styles.sectionHead}>{title}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.dangerSoft : colors.primarySoft;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.primary;
  const gid = `btn${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, overflow: 'hidden' }]}
    >
      {variant === 'primary' ? <GradientBg id={gid} colors={HERO} /> : null}
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel={label || props.placeholder} {...props} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
}) {
  const c = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && { backgroundColor: c, borderColor: c }]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? '#fff' : c} /> : null}
      <Text style={[styles.chipText, selected && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Round "+" for a screen's top bar (navigation.setOptions({ headerRight })). */
export function HeaderAdd({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={{ marginRight: 12 }}>
      <Ionicons name="add-circle" size={30} color={colors.primary} />
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}>{children}</View>;
}

export function ListItem({
  icon,
  iconColor = colors.primary,
  title,
  subtitle,
  right,
  rightSub,
  rightColor,
  onPress,
}: {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
  rightColor?: string;
  onPress?: () => void;
}) {
  // Neutral colours (text/muted) would make a near-white tile in dark mode, so use slate instead.
  const tile = iconColor === colors.text || iconColor === colors.muted ? '#5B6B7A' : iconColor;
  const gid = `li${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, subtitle, right].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.listItem, pressed && onPress && { opacity: 0.7 }]}
    >
      {icon ? (
        <View style={styles.iconBubble}>
          <GradientBg id={gid} colors={[tile, `${tile}B3`]} />
          <Icon name={icon} size={18} color="#fff" />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.itemSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.itemRight, rightColor ? { color: rightColor } : null]}>{right}</Text>
          {rightSub ? <Text style={styles.itemSub}>{rightSub}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** `plain` keeps the given colour; otherwise the bar turns amber near and red over 100%. */
export function ProgressBar({ value, color = colors.primary, plain }: { value: number; color?: string; plain?: boolean }) {
  const pct = Math.max(0, Math.min(1, value));
  const barColor = plain ? color : value > 1 ? colors.danger : value > 0.85 ? colors.warning : color;
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(value, 9.99) * 100) }}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
    </View>
  );
}

export function InsightCard({ insight, money }: { insight: Insight; money: (n: number) => string }) {
  const s = severityStyle[insight.severity];
  return (
    <View style={[styles.insight, { backgroundColor: s.bg }]}>
      <Icon name={insight.icon} size={22} color={s.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.itemTitle, { color: s.fg }]}>{insight.title}</Text>
        <Text style={styles.insightText}>{insight.detail}</Text>
        {insight.monthlySaving && insight.monthlySaving > 0 ? (
          <Text style={[styles.saveTag, { color: s.fg }]}>Potential saving: {money(insight.monthlySaving)}/month</Text>
        ) : null}
      </View>
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={40} color={colors.muted} />
      <Text style={styles.itemTitle}>{title}</Text>
      {text ? <Text style={[styles.itemSub, { textAlign: 'center' }]}>{text}</Text> : null}
    </View>
  );
}

export function Stat({ label, value, color, labelColor, light }: { label: string; value: string; color?: string; labelColor?: string; light?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statLabel, labelColor ? { color: labelColor } : null, light ? { color: '#ffffffb3' } : null]}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null, light ? { color: lightTone(color), fontWeight: '900' } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sectionHead: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  link: { color: colors.primary, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  buttonText: { fontWeight: '700', fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  hint: { fontSize: 12, color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  iconBubble: { width: 38, height: 38, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemRight: { fontSize: 15, fontWeight: '700', color: colors.text },
  progressTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  insight: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  insightText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  saveTag: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
});
