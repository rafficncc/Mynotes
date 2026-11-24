import { ask } from './Dialog';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { formatDate, toISODate } from '../logic/dates';
import {
  backupToDrive,
  fetchGoogleProfile,
  GOOGLE_SCOPES,
  googleConfigured,
  googleIds,
  restoreFromDrive,
  tokenValid,
} from '../services/google';
import { useAppData } from '../store/hooks';
import { useStore } from '../store/useStore';
import { colors } from '../theme';
import { Button, Icon, Row, styles } from './ui';

WebBrowser.maybeCompleteAuthSession();

/** "Continue with Google" – rendered only when OAuth client IDs are configured (hooks need them). */
function GoogleSignInButton({ title, onSignedIn }: { title: string; onSignedIn?: () => void }) {
  const setGoogle = useStore((s) => s.setGoogle);
  const [busy, setBusy] = useState(false);
  // On Android, Google returns a code first; the library swaps it for a token and only then fills `response`.
  const [request, response, promptAsync] = Google.useAuthRequest({ ...googleIds, scopes: GOOGLE_SCOPES, selectAccount: true });

  useEffect(() => {
    if (response?.type === 'error') ask('Google sign-in failed', response.error?.message ?? 'Please try again.');
    const auth = response?.type === 'success' ? response.authentication : null;
    if (!auth?.accessToken) return;
    Promise.resolve()
      .then(() => {
        setBusy(true);
        return fetchGoogleProfile(auth.accessToken, auth.expiresIn);
      })
      .then((g) => {
        const prev = useStore.getState().google;
        setGoogle({ ...g, lastBackup: prev?.email === g.email ? prev.lastBackup : undefined });
        onSignedIn?.();
      })
      .catch((e: Error) => ask('Google sign-in failed', e.message))
      .finally(() => setBusy(false));
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  return busy ? <ActivityIndicator color={colors.primary} /> : <Button title={title} icon="logo-google" disabled={!request} onPress={() => promptAsync()} />;
}

export function GoogleConnectButton({ title = 'Continue with Google', onSignedIn }: { title?: string; onSignedIn?: () => void }) {
  if (!googleConfigured) {
    return (
      <View style={{ gap: 6 }}>
        <Button title={title} icon="logo-google" variant="secondary" disabled onPress={() => undefined} />
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          Google sign-in needs the app’s Google client IDs, which are added when the app is published. Everything else works without it.
        </Text>
      </View>
    );
  }
  return <GoogleSignInButton title={title} onSignedIn={onSignedIn} />;
}

/** Google account + Drive backup / restore panel used in Settings. */
export function GoogleBackupPanel() {
  const data = useAppData();
  const google = useStore((s) => s.google);
  const setGoogle = useStore((s) => s.setGoogle);
  const replaceAll = useStore((s) => s.replaceAll);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  if (!google) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.itemSub}>Sign in to back up to your Google Drive and restore on a new phone.</Text>
        <GoogleConnectButton />
      </View>
    );
  }

  const valid = tokenValid(google);
  const backup = async () => {
    if (!tokenValid(google)) return;
    setBusy('backup');
    try {
      const at = await backupToDrive(google.accessToken, data);
      setGoogle({ ...google, lastBackup: at });
      ask('Backed up', 'Your data is saved in your Google Drive.');
    } catch (e) {
      ask('Backup failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const restore = async () => {
    if (!tokenValid(google)) return;
    setBusy('restore');
    try {
      const found = await restoreFromDrive(google.accessToken);
      if (!found) return ask('No backup found', 'There is no FamilyFin backup in this Google account yet.');
      ask('Restore backup?', `Backup from ${found.savedAt ? formatDate(toISODate(new Date(found.savedAt))) : 'unknown date'} will replace the data on this phone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => { replaceAll({ ...found.data, google }); } },
      ]);
    } catch (e) {
      ask('Restore failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Row>
        <Icon name="logo-google" color={colors.info} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{google.name ?? google.email}</Text>
          <Text style={styles.itemSub}>
            {google.email} · {google.lastBackup ? `last backup ${formatDate(toISODate(new Date(google.lastBackup)))}` : 'not backed up yet'}
          </Text>
        </View>
      </Row>
      {valid ? (
        <>
          <Button title={busy === 'backup' ? 'Backing up…' : 'Back up to Google Drive'} icon="cloud-upload-outline" disabled={!!busy} onPress={backup} />
          <Button title={busy === 'restore' ? 'Checking…' : 'Restore from Google Drive'} variant="secondary" icon="cloud-download-outline" disabled={!!busy} onPress={restore} />
        </>
      ) : (
        <GoogleConnectButton title="Sign in again to back up" />
      )}
      <Button title="Disconnect Google account" variant="danger" icon="log-out-outline" onPress={() => setGoogle(undefined)} />
    </View>
  );
}
