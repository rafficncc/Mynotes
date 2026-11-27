import { PDFDocument } from '@cantoo/pdf-lib';
import { getRandomValues } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Turns the family file into a PDF that only opens with the family password, then opens the share sheet.
 * Returns false where locked PDFs can't be made (the browser preview).
 */
export async function shareLockedPdf(html: string, password: string, name = 'FamilyFin-Family-File.pdf'): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  // PDF encryption needs secure random bytes; Hermes has no Web Crypto, so lend it Expo's.
  const g = globalThis as { crypto?: { getRandomValues?: unknown } };
  if (typeof g.crypto?.getRandomValues !== 'function') g.crypto = { ...g.crypto, getRandomValues };
  const { uri } = await Print.printToFileAsync({ html });
  const printed = new File(uri);
  const doc = await PDFDocument.load(await printed.bytes());
  doc.encrypt({ userPassword: password, ownerPassword: password });
  const locked = new File(Paths.cache, name);
  if (locked.exists) locked.delete();
  locked.create();
  await locked.write(await doc.save());
  printed.delete();
  await Sharing.shareAsync(locked.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share with my family' });
  return true;
}
