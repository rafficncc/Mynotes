export const colors = {
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

export const severityStyle = {
  alert: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  tip: { fg: colors.info, bg: colors.infoSoft },
  good: { fg: colors.success, bg: colors.successSoft },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };
