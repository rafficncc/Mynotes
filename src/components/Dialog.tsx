import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let show: ((d: DialogState) => void) | null = null;

/**
 * Drop-in replacement for Alert.alert. Uses the native alert on phones and an in-app
 * dialog on the web (where React Native's Alert does nothing).
 */
export function ask(title: string, message?: string, buttons?: DialogButton[]) {
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  if (Platform.OS !== 'web') return Alert.alert(title, message, list);
  if (show) show({ title, message, buttons: list });
}

/** Mount once near the root. */
export function DialogHost() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  useEffect(() => {
    show = setDialog;
    return () => {
      show = null;
    };
  }, []);
  if (!dialog) return null;
  const close = (b?: DialogButton) => {
    setDialog(null);
    b?.onPress?.();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(dialog.buttons.find((b) => b.style === 'cancel'))}>
      <View style={s.backdrop}>
        <View style={s.box} accessibilityRole="alert">
          <Text style={s.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={s.message}>{dialog.message}</Text> : null}
          <View style={s.row}>
            {dialog.buttons.map((b) => (
              <Pressable key={b.text} onPress={() => close(b)} style={[s.btn, b.style === 'destructive' && { backgroundColor: colors.dangerSoft }, b.style !== 'cancel' && b.style !== 'destructive' && { backgroundColor: colors.primarySoft }]}>
                <Text style={[s.btnText, b.style === 'destructive' && { color: colors.danger }, b.style === 'cancel' && { color: colors.muted }]}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  box: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 380 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  message: { fontSize: 14, color: colors.text, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  btnText: { fontWeight: '700', color: colors.primary },
});
