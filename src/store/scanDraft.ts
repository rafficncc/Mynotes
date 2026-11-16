import type { ParsedReceipt } from '../logic/receipt';

/** Hands a scanned bill from the scan screen to the add-expense screen (kept in memory only). */
let draft: { uri: string; receipt: ParsedReceipt } | null = null;

export function setScanDraft(d: { uri: string; receipt: ParsedReceipt }) {
  draft = d;
}

export function takeScanDraft() {
  const d = draft;
  draft = null;
  return d;
}
