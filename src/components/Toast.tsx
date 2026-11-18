import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type ToastState = { message: string; action?: { label: string; onPress: () => void } };
let show: ((t: ToastState) => void) | null = null;

/** Short message at the bottom of the screen, optionally with one action (e.g. Undo). */
export function toast(message: string, action?: ToastState['action']) {
  show?.({ message, action });
}

export function ToastHost() {
  const [t, setT] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    show = (next) => {
      setT(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setT(null), 6000);
    };
    return () => {
      show = null;
    };
  }, []);
  if (!t) return null;
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.box} accessibilityLiveRegion="polite">
        <Text style={s.text}>{t.message}</Text>
        {t.action ? (
          <Pressable
            onPress={() => {
              t.action!.onPress();
              setT(null);
            }}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={s.action}>{t.action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 90, alignItems: 'center' },
  box: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.text, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 480 },
  text: { color: colors.bg, flexShrink: 1 },
  action: { color: colors.accent, fontWeight: '800' },
});
