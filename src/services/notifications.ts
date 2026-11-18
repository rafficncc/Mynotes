import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { upcomingReminders } from '../logic/actions';
import { weeklySummary } from '../logic/reports';
import type { AppData } from '../logic/types';

const REMINDER_HOUR = 9;
const MAX_SCHEDULED = 60; // iOS allows 64 pending local notifications

let handlerSet = false;
function ensureHandler() {
  if (handlerSet || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  handlerSet = true;
}

export const notificationsSupported = Platform.OS !== 'web';

export async function requestReminderPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  ensureHandler();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Replaces all scheduled reminders with fresh ones for the next 90 days
 * (bills, EMIs, card dues, document expiries) at 9 AM local time.
 */
export async function syncReminders(data: AppData, money: (n: number) => string): Promise<number> {
  if (!notificationsSupported) return 0;
  ensureHandler();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!data.settings.notificationsEnabled) return 0;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Payment & renewal reminders', importance: AndroidImportance.HIGH });
  }
  const now = Date.now();
  let count = 0;
  for (const r of upcomingReminders(data, new Date(), 90, money)) {
    const at = new Date(r.date);
    at.setHours(REMINDER_HOUR, 0, 0, 0);
    if (at.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { route: '/actions' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
    });
    if (++count >= MAX_SCHEDULED) break;
  }
  // Weekly summary every Sunday 7 PM. Re-scheduled on every data change, so the numbers stay current.
  if (data.settings.weeklySummary !== false) {
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
    sunday.setHours(19, 0, 0, 0);
    if (sunday.getTime() <= now) sunday.setDate(sunday.getDate() + 7);
    const w = weeklySummary(data.transactions, sunday);
    const trend = w.pct === null ? '' : w.pct <= 0 ? ` – ${-w.pct}% less than last week 👏` : ` – ${w.pct}% more than last week`;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Your week in FamilyFin', body: `You spent ${money(w.spent)} this week${trend}.`, data: { route: '/reports' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: sunday, channelId: 'reminders' },
    });
  }
  return count;
}
