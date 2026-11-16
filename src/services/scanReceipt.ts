import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { lineSlope, parseReceipt, type OcrLine, type ParsedReceipt } from '../logic/receipt';
import type { Transaction } from '../logic/types';

/**
 * Bill scanning: take or pick a photo, read the text on the phone with Google ML Kit
 * (nothing is uploaded), and turn it into expense details.
 */

export type ScanSource = 'camera' | 'library';

export class ScanError extends Error {}

type Recognize = (uri: string) => Promise<{
  blocks: { lines: { text: string; frame: Rect; elements: { frame: Rect }[] }[] }[];
}>;
type Rect = { left: number; top: number; right: number; bottom: number };

async function loadRecognizer(): Promise<Recognize> {
  if (Platform.OS === 'web') throw new ScanError('Bill scanning works in the installed Android or iPhone app, not in the browser preview.');
  try {
    const mod = await import('@infinitered/react-native-mlkit-text-recognition');
    return mod.recognizeText as unknown as Recognize;
  } catch {
    throw new ScanError('Bill scanning needs the installed FamilyFin app (it is not available in Expo Go).');
  }
}

async function pickImage(source: ScanSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    // Android's editor lets the user crop to just the bill; iOS only offers a square crop.
    allowsEditing: Platform.OS === 'android',
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new ScanError('Allow camera access for FamilyFin in your phone settings to scan bills.');
    const res = await ImagePicker.launchCameraAsync(options);
    return res.canceled ? null : res.assets[0]?.uri ?? null;
  }
  const res = await ImagePicker.launchImageLibraryAsync(options);
  return res.canceled ? null : res.assets[0]?.uri ?? null;
}

/** Returns null when the user cancels. */
export async function scanBill(
  source: ScanSource,
  opts: { history: Transaction[]; monthFirst: boolean },
): Promise<{ uri: string; receipt: ParsedReceipt } | null> {
  const recognize = await loadRecognizer();
  const uri = await pickImage(source);
  if (!uri) return null;
  const text = await recognize(uri);
  const lines: OcrLine[] = text.blocks.flatMap((b) =>
    b.lines.map((l) => ({ text: l.text, ...l.frame, slope: lineSlope(l.elements.map((e) => e.frame)) })),
  );
  if (!lines.length) throw new ScanError('No text found. Lay the bill flat in good light and fill the frame with it.');
  return { uri, receipt: parseReceipt(lines, { history: opts.history, monthFirst: opts.monthFirst }) };
}
