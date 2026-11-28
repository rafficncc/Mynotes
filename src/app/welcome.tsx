import { router } from 'expo-router';
import { useState } from 'react';
import { ask } from '../components/Dialog';
import { changeLanguage, lang, LANGUAGES, t } from '../i18n';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleConnectButton } from '../components/GoogleBackup';
import { Button, Chip, ChipRow, Icon, Screen, styles } from '../components/ui';
import { GradientBg } from '../components/GradientBg';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

// Feature tiles: icon, title, line, tile colour (same family as the Home tiles).
const FEATURES: [string, string, string, string][] = [
  ['shield-checkmark', 'Money Vault', 'Everything your family needs if something happens to you', '#6E48C2'],
  ['umbrella', 'Emergency fund', 'Kept apart and untouched, with a clear target', '#14918B'],
  ['card', 'Smart card picker', 'Which card to swipe for the most interest-free days', '#2F6FC4'],
  ['bulb', 'Savings coach', 'Finds money leaks and shows what you can save', '#B9860F'],
  ['trending-down', 'Debt-free journey', 'Clear debts step by step with the snowball plan', '#C9671C'],
  ['notifications', 'Never miss a due date', 'Bills, EMIs, card dues and passport or visa expiry', '#C2414F'],
];

export default function Welcome() {
  const loadDemo = useStore((s) => s.loadDemo);

  const [, rerender] = useState(0);
  // Guided first-time setup: salary account, salary day, cash, cards, rent.
  const start = () => router.push('/setup');
  const demo = () => {
    loadDemo();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <ChipRow>
          {LANGUAGES.filter((l) => l.key !== 'auto').map((l) => (
            <Chip
              key={l.key}
              label={l.label}
              selected={lang === l.key}
              onPress={() => {
                if (changeLanguage(l.key)) ask(t('Close and reopen FamilyFin to apply.'));
                rerender((n) => n + 1);
              }}
            />
          ))}
        </ChipRow>
        {/* Hero, in the app's gradient */}
        <View style={{ borderRadius: 24, overflow: 'hidden' }}>
          <GradientBg id="welcomebg" />
          <View pointerEvents="none" style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#ffffff10', top: -90, right: -80 }} />
          <View pointerEvents="none" style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#ffffff0a', bottom: -60, left: -50 }} />
          <View style={{ padding: 22, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="home" size={34} color="#FFD978" />
            </View>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>FamilyFin</Text>
            <Text style={{ color: '#ffffffd9', fontSize: 15, lineHeight: 21 }}>The money coach for every family. Track, understand and grow your family’s money.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {['No bank login', 'No SMS reading', 'Data stays on your phone'].map((x) => (
                <View key={x} style={{ backgroundColor: '#ffffff1f', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#7EE3B5', fontSize: 11, fontWeight: '800' }}>✓ {x}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {FEATURES.map(([icon, title, text, c]) => (
            <View key={title} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={18} color="#fff" />
              </View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}>{text}</Text>
            </View>
          ))}
        </View>

        <GoogleConnectButton onSignedIn={start} />
        <Button title={t('Set up my accounts')} icon="arrow-forward" onPress={start} />
        <Button title={t('Explore with demo data')} variant="secondary" icon="play-outline" onPress={demo} />
        <Text style={[styles.hint, { textAlign: 'center' }]}>You can clear demo data any time from Settings.</Text>
      </Screen>
    </SafeAreaView>
  );
}
