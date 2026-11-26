import { FreeUsesLeft, takeFreeUse } from '../components/PremiumGate';
import { getLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Button, Card, Icon, Screen, styles } from '../components/ui';
import { parseSpoken } from '../logic/voice';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

type Speech = typeof import('expo-speech-recognition');

export default function Voice() {
  const params = useLocalSearchParams<{ text?: string }>();
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const [text, setText] = useState(params.text ?? '');
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [error, setError] = useState('');

  const go = (said: string) => {
    if (!takeFreeUse('voice')) return;
    const e = parseSpoken(said, accounts, transactions);
    const q = new URLSearchParams({ type: e.type, voice: '1' });
    if (e.amount) q.set('amount', String(e.amount));
    if (e.merchant) q.set('merchant', e.merchant);
    if (e.categoryId) q.set('categoryId', e.categoryId);
    if (e.accountId) q.set('accountId', e.accountId);
    router.replace(`/add?${q.toString()}`);
  };

  // Opened from Siri / Google Assistant with familyfin://voice?text=…
  useEffect(() => {
    if (params.text) go(params.text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The speech module is native-only (not in the browser preview or Expo Go).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    import('expo-speech-recognition').then(setSpeech).catch(() => setSpeech(null));
  }, []);

  useEffect(() => {
    if (!speech) return;
    const m = speech.ExpoSpeechRecognitionModule;
    const subs = [
      m.addListener('result', (ev) => {
        const said = ev.results[0]?.transcript ?? '';
        setText(said);
        if (ev.isFinal && said) go(said);
      }),
      m.addListener('end', () => setListening(false)),
      m.addListener('error', (ev) => {
        setListening(false);
        if (ev.error !== 'no-speech' && ev.error !== 'aborted') setError('Could not hear that. Try again or type it below.');
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [speech]); // eslint-disable-line react-hooks/exhaustive-deps

  const listen = async () => {
    setError('');
    if (!speech) return setError('Voice input works in the installed app. Type the expense below instead.');
    const m = speech.ExpoSpeechRecognitionModule;
    if (listening) return m.stop();
    const perm = await m.requestPermissionsAsync();
    if (!perm.granted) return setError('Allow microphone access for FamilyFin in your phone settings.');
    setText('');
    setListening(true);
    m.start({ lang: getLocales()[0]?.languageTag ?? 'en-IN', interimResults: true, continuous: false });
  };

  return (
    <Screen>
      <FreeUsesLeft kind="voice" />
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <Pressable
          onPress={listen}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Speak an expense'}
          style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: listening ? colors.danger : colors.primary }}
        >
          <Icon name={listening ? 'stop' : 'mic'} size={44} color="#fff" />
        </Pressable>
        <Text style={styles.sectionTitle}>{listening ? 'Listening…' : 'Tap and say it'}</Text>
        <Text style={[styles.itemSub, { textAlign: 'center' }]}>“200 cash milk” · “450 petrol with HDFC card” · “received 85000 salary in bank”</Text>
        {text ? <Text style={[styles.itemTitle, { textAlign: 'center' }]}>“{text}”</Text> : null}
        {error ? <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.label}>Or type it</Text>
        <TextInput value={text} onChangeText={setText} placeholder="200 cash milk" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => text.trim() && go(text)} returnKeyType="go" accessibilityLabel="Expense in words" />
        <Button title="Continue" icon="arrow-forward" disabled={!text.trim()} onPress={() => go(text)} />
      </Card>
      <View>
        <Text style={styles.hint}>
          Siri / Google Assistant: create a shortcut that opens the link familyfin://voice?text= followed by what you say, e.g. “Hey Siri, FamilyFin expense”.
        </Text>
      </View>
    </Screen>
  );
}
