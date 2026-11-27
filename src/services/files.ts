import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Saves text as a real file (CSV, JSON…) and opens the share sheet, or downloads it in a browser. */
export async function shareTextFile(name: string, text: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mimeType }));
    a.download = name;
    a.click();
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: mimeType === 'application/json' ? 'public.json' : 'public.comma-separated-values-text' });
}

/** Lets the user pick a file and returns its text, or null if they cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}
