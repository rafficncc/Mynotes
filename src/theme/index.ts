import { Appearance } from 'react-native';
import { getThemePref } from './prefs';

const light = {
  primary: '#0B6E4F',
  primaryDark: '#08513A',
  primarySoft: '#E3F2EC',
  accent: '#F4A259',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1B1F24',
  muted: '#6B7280',
  border: '#E5E7EB',
  danger: '#D64545',
  dangerSoft: '#FDECEC',
  warning: '#C77700',
  warningSoft: '#FFF4E0',
  info: '#2563EB',
  infoSoft: '#E8F0FE',
  success: '#15803D',
  successSoft: '#E7F6EC',
};

const dark: typeof light = {
  primary: '#1F9D72',
  primaryDark: '#147A57',
  primarySoft: '#16352B',
  accent: '#F4A259',
  bg: '#0F1417',
  card: '#1A2126',
  text: '#E8ECEF',
  muted: '#9AA4AE',
  border: '#2C353C',
  danger: '#F07070',
  dangerSoft: '#3A1F22',
  warning: '#E3A23B',
  warningSoft: '#3A2E17',
  info: '#79A8FF',
  infoSoft: '#1B2740',
  success: '#4CC47F',
  successSoft: '#173322',
};

const pref = getThemePref();
/** True when the app draws in dark mode (system setting or the user's choice, applied at start-up). */
export const isDark = pref === 'dark' || (pref === 'system' && Appearance.getColorScheme() === 'dark');
export const colors = isDark ? dark : light;

export const severityStyle = {
  alert: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  tip: { fg: colors.info, bg: colors.infoSoft },
  good: { fg: colors.success, bg: colors.successSoft },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };
