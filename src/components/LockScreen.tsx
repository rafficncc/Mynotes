import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { pinLength, unlockWithBiometrics, verifyPin } from '../services/appLock';
import { useHydrated } from '../store/useHydrated';
import { useStore } from '../store/useStore';
import { colors } from '../theme';
import { Icon } from './ui';

/** Current time, read only inside event handlers. */
const clock = () => Date.now();

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

/** PIN keypad with optional fingerprint / face button. Calls onUnlock when the PIN or biometrics match. */
export function PinPad({ title, onUnlock, useBiometrics }: { title: string; onUnlock: () => void; useBiometrics?: boolean }) {
  const [entry, setEntry] = useState('');
  const [length, setLength] = useState(4);
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);

  const bio = async () => {
    if (await unlockWithBiometrics()) onUnlock();
  };
  useEffect(() => {
    pinLength().then((n) => n && setLength(n));
    if (useBiometrics) bio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const press = async (k: string) => {
    if (k === 'bio') return bio();
    if (k === 'del') return setEntry((e) => e.slice(0, -1));
    if (clock() < waitUntil) return setError('Too many tries. Wait 30 seconds.');
    const next = entry + k;
    setEntry(next);
    if (next.length < length) return;
    if (await verifyPin(next)) {
      setFails(0);
      onUnlock();
    } else {
      const f = fails + 1;
      setFails(f);
      if (f >= 5) setWaitUntil(clock() + 30_000);
      setError(f >= 5 ? 'Too many tries. Wait 30 seconds.' : 'Wrong PIN, try again.');
    }
    setEntry('');
  };

  return (
    <View style={s.wrap}>
      <Icon name="lock-closed" size={36} color={colors.primary} />
      <Text style={s.title}>{title}</Text>
      <View style={s.dots} accessibilityLabel={`${entry.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[s.dot, i < entry.length && { backgroundColor: colors.primary }]} />
        ))}
      </View>
      <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>
      <View style={s.pad}>
        {KEYS.map((k) =>
          k === 'bio' && !useBiometrics ? (
            <View key={k} style={s.key} />
          ) : (
            <Pressable
              key={k}
              style={({ pressed }) => [s.key, pressed && { backgroundColor: colors.primarySoft }]}
              onPress={() => press(k)}
              accessibilityRole="button"
              accessibilityLabel={k === 'bio' ? 'Unlock with fingerprint or face' : k === 'del' ? 'Delete digit' : k}
            >
              {k === 'bio' ? <Icon name="finger-print" size={28} color={colors.primary} /> : k === 'del' ? <Icon name="backspace-outline" size={26} /> : <Text style={s.keyText}>{k}</Text>}
            </Pressable>
          ),
        )}
      </View>
      <Text style={s.hint}>Forgot your PIN? Use fingerprint/face if set up. Otherwise reinstall and restore from your Google Drive backup.</Text>
    </View>
  );
}

/** Covers the app with the PIN pad on launch and after it was in the background longer than the chosen time. */
export function LockGate() {
  const hydrated = useHydrated();
  const enabled = useStore((st) => !!st.settings.lockEnabled);
  const minutes = useStore((st) => st.settings.lockAfterMinutes ?? 1);
  const useBiometrics = useStore((st) => !!st.settings.useBiometrics);
  const [locked, setLocked] = useState(true);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current !== null) {
        if (Date.now() - leftAt.current >= minutes * 60_000) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [minutes]);

  if (!hydrated || !enabled || !locked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, zIndex: 1000 }]}>
      <PinPad title={t('Enter your PIN')} useBiometrics={useBiometrics} onUnlock={() => setLocked(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  dots: { flexDirection: 'row', gap: 14, marginVertical: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.primary },
  error: { color: colors.danger, minHeight: 18 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 270, justifyContent: 'center' },
  key: { width: 76, height: 64, margin: 7, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 28, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', maxWidth: 300 },
});
