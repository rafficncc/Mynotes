import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import { getLangPref, setLangPref, type LangPref } from '../theme/prefs';
import { STRINGS } from './strings';

export const LANGUAGES: { key: LangPref; label: string }[] = [
  { key: 'auto', label: 'Same as phone' },
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'हिन्दी' },
  { key: 'ml', label: 'മലയാളം' },
  { key: 'ta', label: 'தமிழ்' },
  { key: 'ar', label: 'العربية' },
];

const COLUMN = { hi: 1, ml: 2, ta: 3, ar: 4 } as const;
type Lang = 'en' | keyof typeof COLUMN;

function resolve(): Lang {
  const pref = getLangPref();
  const wanted = pref === 'auto' ? getLocales()[0]?.languageCode ?? 'en' : pref;
  return wanted in COLUMN ? (wanted as Lang) : 'en';
}

/** Language chosen at start-up. */
export let lang: Lang = resolve();
export const isRTL = lang === 'ar';

// Arabic is laid out right-to-left; React Native applies this from the next launch.
if (I18nManager.isRTL !== isRTL) {
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

const build = (l: Lang): Record<string, string> => (l === 'en' ? {} : Object.fromEntries(STRINGS.map((row) => [row[0], row[COLUMN[l]]])));
let dict = build(lang);

/**
 * Switches language now for screens drawn from here on; also saved for next launch.
 * Returns true when the app must be reopened (switching to or from right-to-left Arabic).
 */
export function changeLanguage(pref: LangPref): boolean {
  setLangPref(pref);
  lang = resolve();
  dict = build(lang);
  return (lang === 'ar') !== I18nManager.isRTL;
}

/** Translates an English UI string (falls back to English). */
export function t(text: string): string {
  return dict[text] ?? text;
}
