import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
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

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: string; size?: number; color?: string }) {
  return <Ionicons name={name as IconName} size={size} color={color} />;
}

export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: padded ? spacing.lg : 0, paddingBottom: 100, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
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
      style={[styles.chip, selected && { backgroundColor: c, borderColor: c }]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? '#fff' : c} /> : null}
      <Text style={[styles.chipText, selected && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
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
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listItem, pressed && onPress && { opacity: 0.7 }]}>
      {icon ? (
        <View style={[styles.iconBubble, { backgroundColor: `${iconColor}1A` }]}>
          <Icon name={icon} size={18} color={iconColor} />
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
    <View style={styles.progressTrack}>
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

export function Stat({ label, value, color, labelColor }: { label: string; value: string; color?: string; labelColor?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
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
  iconBubble: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
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
