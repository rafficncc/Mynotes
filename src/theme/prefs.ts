import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Preferences needed before the first screen draws (theme, language). Read synchronously at
 * start-up; changes apply the next time the app opens (Arabic's right-to-left layout needs that too).
 */
export type ThemePref = 'system' | 'light' | 'dark';
export type LangPref = 'auto' | 'en' | 'hi' | 'ml' | 'ta' | 'ar';

function read(key: string): string | null {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else SecureStore.setItem(key, value);
  } catch {
    // Preference not saved – the app keeps the default.
  }
}

export const getThemePref = () => (read('familyfin-theme') as ThemePref | null) ?? 'system';
export const setThemePref = (v: ThemePref) => write('familyfin-theme', v);
export const getLangPref = () => (read('familyfin-lang') as LangPref | null) ?? 'auto';
export const setLangPref = (v: LangPref) => write('familyfin-lang', v);
