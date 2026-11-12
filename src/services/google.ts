import Constants from 'expo-constants';
import type { AppData, GoogleAccount } from '../logic/types';

/**
 * Google sign-in + Google Drive backup.
 *
 * Setup (once, by the developer): create OAuth client IDs in Google Cloud Console
 * (Android, iOS and Web), enable the Google Drive API, and put the IDs in app.json →
 * expo.extra.google { androidClientId, iosClientId, webClientId }.
 *
 * Backups go to the hidden "app data" folder of the user's own Drive, so the app can only
 * see its own backup file and nothing else in their Drive.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const GOOGLE_SCOPES = ['openid', 'profile', 'email', DRIVE_SCOPE];
const BACKUP_NAME = 'familyfin-backup.json';

type GoogleIds = { androidClientId?: string; iosClientId?: string; webClientId?: string };

export const googleIds: GoogleIds = (Constants.expoConfig?.extra?.google as GoogleIds | undefined) ?? {};
export const googleConfigured = !!(googleIds.androidClientId || googleIds.iosClientId || googleIds.webClientId);

export async function fetchGoogleProfile(accessToken: string, expiresIn?: number): Promise<GoogleAccount> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error('Could not read your Google profile.');
  const p = (await res.json()) as { email: string; name?: string; picture?: string };
  return { email: p.email, name: p.name, photo: p.picture, accessToken, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 };
}

export function tokenValid(g?: GoogleAccount): g is GoogleAccount & { accessToken: string } {
  return !!g?.accessToken && (g.expiresAt ?? 0) > Date.now() + 30_000;
}

async function driveRequest(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (res.status === 401) throw new Error('Your Google sign-in has expired. Sign in again.');
  if (!res.ok) throw new Error(`Google Drive error (${res.status}).`);
  return res;
}

async function findBackup(token: string): Promise<{ id: string; modifiedTime: string } | null> {
  const q = encodeURIComponent(`name='${BACKUP_NAME}'`);
  const res = await driveRequest(token, `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`);
  const body = (await res.json()) as { files: { id: string; modifiedTime: string }[] };
  return body.files[0] ?? null;
}

/** Uploads (or replaces) the backup file. Login tokens are never included in the backup. */
export async function backupToDrive(token: string, data: AppData): Promise<string> {
  const content = JSON.stringify({ ...data, google: undefined, app: 'FamilyFin', version: 2, savedAt: new Date().toISOString() });
  const existing = await findBackup(token);
  if (existing) {
    await driveRequest(token, `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: content,
    });
  } else {
    const boundary = 'familyfin' + Date.now();
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: BACKUP_NAME, parents: ['appDataFolder'] }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    await driveRequest(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }
  return new Date().toISOString();
}

export async function restoreFromDrive(token: string): Promise<{ data: AppData; savedAt?: string } | null> {
  const existing = await findBackup(token);
  if (!existing) return null;
  const res = await driveRequest(token, `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  const data = (await res.json()) as AppData & { savedAt?: string };
  return { data, savedAt: data.savedAt ?? existing.modifiedTime };
}
