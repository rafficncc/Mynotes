import type { AppData, FamilyGroup, Member, Transaction } from './types';

/**
 * Family group without a server: every phone keeps its own data. The organiser shares an
 * invite code (group + members + allowances); each member shares an "update code" with the
 * spends they logged, and the organiser imports it. Imports are idempotent (merged by id).
 */

const INVITE = 'FFI1:';
const UPDATE = 'FFU1:';

function encode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return btoa(bytes);
}

function decode<T>(s: string): T {
  const bytes = atob(s.trim());
  const json = decodeURIComponent(
    Array.from(bytes)
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(json) as T;
}

export function newGroupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface InvitePayload {
  g: string;
  n: string;
  c: string;
  m: Member[];
}

export function makeInvite(group: FamilyGroup, members: Member[]): string {
  return INVITE + encode({ g: group.id, n: group.name, c: group.code, m: members } satisfies InvitePayload);
}

export function parseInvite(text: string): { group: FamilyGroup; members: Member[] } {
  const raw = text.trim();
  if (!raw.startsWith(INVITE)) throw new Error('This is not a FamilyFin invite code.');
  const p = decode<InvitePayload>(raw.slice(INVITE.length));
  return { group: { id: p.g, name: p.n, code: p.c, isAdmin: false }, members: p.m };
}

interface UpdatePayload {
  g: string;
  from: string;
  t: Transaction[];
}

/** Spends logged by `memberId` on this phone (optionally only since a date). */
export function makeUpdate(data: AppData, memberId: string, since?: string): string {
  if (!data.group) throw new Error('Join a family group first.');
  const t = data.transactions.filter((x) => x.memberId === memberId && x.type !== 'transfer' && (!since || x.createdAt >= since));
  return UPDATE + encode({ g: data.group.id, from: memberId, t } satisfies UpdatePayload);
}

export function parseUpdate(text: string, data: AppData): { memberId: string; transactions: Transaction[] } {
  const raw = text.trim();
  if (!raw.startsWith(UPDATE)) throw new Error('This is not a FamilyFin update code.');
  const p = decode<UpdatePayload>(raw.slice(UPDATE.length));
  if (data.group && p.g !== data.group.id) throw new Error('This update belongs to a different family group.');
  return { memberId: p.from, transactions: p.t };
}

/** Adds transactions not seen before; spends land in the organiser's "Family wallet" account. */
export function mergeTransactions(existing: Transaction[], incoming: Transaction[], accountId: string): { merged: Transaction[]; added: number } {
  const ids = new Set(existing.map((t) => t.id));
  const fresh = incoming.filter((t) => !ids.has(t.id)).map((t) => ({ ...t, accountId, toAccountId: undefined, emiPlanId: undefined }));
  return { merged: [...fresh, ...existing], added: fresh.length };
}
