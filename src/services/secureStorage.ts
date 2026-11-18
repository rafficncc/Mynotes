import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';
import { base64ToUtf8, utf8ToBase64 } from '../logic/familySync';

/**
 * App data is saved encrypted (AES-256-GCM). The key is created on first run and kept in the
 * phone's secure keystore (Android Keystore / iOS Keychain), so the saved file is unreadable
 * without this phone. The browser preview has no keystore and saves plainly.
 */

const KEY_NAME = 'familyfin-data-key';
const PREFIX = 'ENC1:';
const encrypt = Platform.OS !== 'web';

let keyPromise: Promise<AESEncryptionKey> | null = null;
function getKey(): Promise<AESEncryptionKey> {
  keyPromise ??= (async () => {
    const saved = await SecureStore.getItemAsync(KEY_NAME);
    if (saved) return AESEncryptionKey.import(saved, 'base64');
    const key = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(KEY_NAME, await key.encoded('base64'));
    return key;
  })();
  return keyPromise;
}

// Writes run one after another so an older state can never overwrite a newer one.
let queue: Promise<void> = Promise.resolve();

export const encryptedStorage: StateStorage = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name);
    if (!raw || !raw.startsWith(PREFIX)) return raw; // plain data from older versions is encrypted on the next save
    try {
      const sealed = AESSealedData.fromCombined(raw.slice(PREFIX.length));
      return base64ToUtf8(await aesDecryptAsync(sealed, await getKey(), { output: 'base64' }));
    } catch {
      // Never let an unreadable file be overwritten by an empty state: keep a copy first.
      await AsyncStorage.setItem(`${name}-unreadable-${Date.now()}`, raw);
      return null;
    }
  },
  setItem: (name, value) => {
    queue = queue.then(async () => {
      if (!encrypt) return AsyncStorage.setItem(name, value);
      const sealed = await aesEncryptAsync(utf8ToBase64(value), await getKey());
      await AsyncStorage.setItem(name, PREFIX + (await sealed.combined('base64')));
    });
    return queue;
  },
  removeItem: (name) => AsyncStorage.removeItem(name),
};
