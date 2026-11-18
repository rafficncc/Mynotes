import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { ask } from '../components/Dialog';
import { Button, Card, Chip, ChipRow, Row, Screen, SectionTitle, styles } from '../components/ui';
import { biometricsAvailable, clearPin, setPin, unlockWithBiometrics, verifyPin } from '../services/appLock';
import { useStore } from '../store/useStore';
import { colors } from '../theme';

const AFTER = [0, 1, 5, 15];

export default function Security() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [bioOk, setBioOk] = useState(false);
  const [step, setStep] = useState<'idle' | 'new' | 'confirm' | 'off'>('idle');
  const [pin, setPinText] = useState('');
  const [first, setFirst] = useState('');

  useEffect(() => {
    biometricsAvailable().then(setBioOk);
  }, []);

  const submit = async () => {
    if (step === 'new') {
      if (!/^\d{4,6}$/.test(pin)) return ask('Use 4 to 6 digits');
      setFirst(pin);
      setPinText('');
      return setStep('confirm');
    }
    if (step === 'confirm') {
      if (pin !== first) {
        setPinText('');
        setStep('new');
        return ask('PINs did not match', 'Please enter a new PIN again.');
      }
      await setPin(pin);
      updateSettings({ lockEnabled: true, lockAfterMinutes: settings.lockAfterMinutes ?? 1, useBiometrics: bioOk });
      setStep('idle');
      setPinText('');
      return ask('App lock is on', bioOk ? 'Unlock with your PIN or fingerprint/face.' : 'Unlock with your PIN.');
    }
    if (step === 'off') {
      if (!(await verifyPin(pin))) return ask('Wrong PIN');
      await clearPin();
      updateSettings({ lockEnabled: false });
      setStep('idle');
      setPinText('');
    }
  };

  const turnOff = async () => {
    // Fingerprint/face is enough to turn the lock off; otherwise ask for the PIN.
    if (settings.useBiometrics && (await unlockWithBiometrics('Turn off app lock'))) {
      await clearPin();
      return updateSettings({ lockEnabled: false });
    }
    setStep('off');
  };

  return (
    <Screen>
      <SectionTitle title="App lock" />
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Lock FamilyFin</Text>
            <Text style={styles.itemSub}>Ask for a PIN{bioOk ? ' or fingerprint/face' : ''} when the app opens.</Text>
          </View>
          <Switch
            value={!!settings.lockEnabled}
            onValueChange={(v) => (v ? setStep('new') : turnOff())}
            trackColor={{ true: colors.primary }}
            accessibilityLabel="App lock"
          />
        </Row>
        {step !== 'idle' ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>{step === 'new' ? 'Choose a 4–6 digit PIN' : step === 'confirm' ? 'Enter the PIN again' : 'Enter your PIN to turn the lock off'}</Text>
            <TextInput
              value={pin}
              onChangeText={(t) => setPinText(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              style={[styles.input, { letterSpacing: 8, fontSize: 22 }]}
              accessibilityLabel="PIN"
            />
            <Row>
              <View style={{ flex: 1 }}><Button title="Continue" onPress={submit} /></View>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={() => { setStep('idle'); setPinText(''); }} /></View>
            </Row>
          </View>
        ) : null}
        {settings.lockEnabled ? (
          <>
            <Text style={styles.label}>Lock again after the app was in the background</Text>
            <ChipRow>
              {AFTER.map((m) => (
                <Chip key={m} label={m === 0 ? 'Immediately' : `${m} min`} selected={(settings.lockAfterMinutes ?? 1) === m} onPress={() => updateSettings({ lockAfterMinutes: m })} />
              ))}
            </ChipRow>
            {bioOk ? (
              <Row>
                <Text style={[styles.itemTitle, { flex: 1 }]}>Use fingerprint / face</Text>
                <Switch value={!!settings.useBiometrics} onValueChange={(v) => updateSettings({ useBiometrics: v })} trackColor={{ true: colors.primary }} accessibilityLabel="Use fingerprint or face" />
              </Row>
            ) : null}
            <Button title="Change PIN" variant="secondary" icon="key-outline" onPress={() => setStep('new')} />
          </>
        ) : null}
      </Card>

      <SectionTitle title="Privacy" />
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Hide amounts</Text>
            <Text style={styles.itemSub}>Shows ₹•••• instead of numbers, for using the app in public. Tap the eye on Home to switch quickly.</Text>
          </View>
          <Switch value={!!settings.hideAmounts} onValueChange={(v) => updateSettings({ hideAmounts: v })} trackColor={{ true: colors.primary }} accessibilityLabel="Hide amounts" />
        </Row>
      </Card>

      <SectionTitle title="Your data on this phone" />
      <Card>
        <Text style={styles.itemSub}>
          Everything FamilyFin saves on this phone is encrypted (AES-256). The key is kept in the phone’s secure keystore, so the data can’t be read by other apps or from a copied file. Bill photos are stored in the app’s private folder.
        </Text>
      </Card>
    </Screen>
  );
}
