import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** App lock: a salted PIN hash in the secure keystore, plus optional fingerprint / face unlock. */

const PIN_KEY = 'familyfin-pin';
const web = Platform.OS === 'web';
const read = (k: string) => (web ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k));
const write = (k: string, v: string) => (web ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v));
const remove = (k: string) => (web ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k));

const hash = (pin: string, salt: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  await write(PIN_KEY, JSON.stringify({ salt, hash: await hash(pin, salt), length: pin.length }));
}

export async function pinLength(): Promise<number | null> {
  const raw = await read(PIN_KEY);
  return raw ? (JSON.parse(raw) as { length: number }).length : null;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = await read(PIN_KEY);
  if (!raw) return false;
  const saved = JSON.parse(raw) as { salt: string; hash: string };
  return (await hash(pin, saved.salt)) === saved.hash;
}

export const clearPin = () => remove(PIN_KEY);

export async function biometricsAvailable(): Promise<boolean> {
  if (web) return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function unlockWithBiometrics(promptMessage = 'Unlock FamilyFin'): Promise<boolean> {
  if (!(await biometricsAvailable())) return false;
  const res = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Use PIN', disableDeviceFallback: true });
  return res.success;
}
