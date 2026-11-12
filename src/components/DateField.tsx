import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, clampedDate, daysInMonth, formatDate, parseDate, toISODate } from '../logic/dates';
import { colors, radius, spacing } from '../theme';
import { Icon } from './ui';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month-grid calendar. `marks` puts a dot under dates (e.g. days with transactions). */
export function Calendar({
  value,
  onChange,
  marks,
  minDate,
}: {
  value?: string;
  onChange: (iso: string) => void;
  marks?: Record<string, string>;
  minDate?: string;
}) {
  const initial = value ? parseDate(value) : new Date();
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const first = new Date(view.y, view.m, 1);
  const total = daysInMonth(view.y, view.m);
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayIso = toISODate(new Date());
  const shift = (n: number) => {
    const d = clampedDate(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={s.header}>
        <Pressable onPress={() => setView({ y: view.y - 1, m: view.m })} hitSlop={8} accessibilityLabel="Previous year">
          <Icon name="play-back-outline" size={16} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityLabel="Previous month">
          <Icon name="chevron-back" />
        </Pressable>
        <Text style={s.title}>{first.toLocaleString('en', { month: 'long', year: 'numeric' })}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={8} accessibilityLabel="Next month">
          <Icon name="chevron-forward" />
        </Pressable>
        <Pressable onPress={() => setView({ y: view.y + 1, m: view.m })} hitSlop={8} accessibilityLabel="Next year">
          <Icon name="play-forward-outline" size={16} color={colors.muted} />
        </Pressable>
      </View>
      <View style={s.grid}>
        {WEEK.map((w, i) => (
          <Text key={i} style={s.week}>{w}</Text>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={s.cell} />;
          const iso = toISODate(new Date(view.y, view.m, day));
          const selected = iso === value;
          const disabled = !!minDate && iso < minDate;
          return (
            <Pressable key={i} style={s.cell} disabled={disabled} onPress={() => onChange(iso)}>
              <View style={[s.day, selected && { backgroundColor: colors.primary }, !selected && iso === todayIso && s.today]}>
                <Text style={[s.dayText, selected && { color: '#fff', fontWeight: '700' }, disabled && { color: colors.border }]}>{day}</Text>
              </View>
              {marks?.[iso] ? <View style={[s.dot, { backgroundColor: marks[iso] }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A form field that opens a calendar. Value is YYYY-MM-DD (or '' when optional and empty). */
export function DateField({
  label,
  value,
  onChange,
  optional,
  quick = true,
  hint,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean;
  quick?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = toISODate(new Date());
  const yesterday = toISODate(addDays(new Date(), -1));
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable style={s.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <Icon name="calendar-outline" color={colors.primary} />
        <Text style={[s.value, !value && { color: colors.muted }]}>{value ? formatDate(value) : 'Pick a date'}</Text>
        {optional && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear date">
            <Icon name="close-circle" color={colors.muted} size={18} />
          </Pressable>
        ) : null}
      </Pressable>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => undefined}>
            <Text style={s.title}>{label || 'Choose date'}</Text>
            {quick ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[['Today', today], ['Yesterday', yesterday]].map(([l, v]) => (
                  <Pressable key={l} style={[s.quick, value === v && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => { onChange(v); setOpen(false); }}>
                    <Text style={{ color: value === v ? '#fff' : colors.text, fontWeight: '600' }}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Calendar value={value || undefined} onChange={(v) => { onChange(v); setOpen(false); }} />
            <Pressable onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end', padding: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  week: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: colors.muted, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2, minHeight: 42 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.primary },
  dayText: { fontSize: 14, color: colors.text },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  hint: { fontSize: 12, color: colors.muted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  value: { flex: 1, fontSize: 16, color: colors.text },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, maxWidth: 420, width: '100%', alignSelf: 'center' },
  quick: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
});
