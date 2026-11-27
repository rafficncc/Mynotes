import { computeBalances } from './balances';
import { personBalances } from './money2';
import type { AppData, VaultEntry } from './types';

type Extra = { key: string; label: string; placeholder?: string };
export interface VaultCategory {
  key: string;
  group: string;
  label: string;
  icon: string;
  hint: string;
  /** Ask for a nominee and warn when it is missing. */
  nominee?: boolean;
  extra?: Extra[];
}

const last4: Extra = { key: 'last4', label: 'Number (last 4 digits only)', placeholder: 'e.g. 4321' };

/** Everything a family may need to know, grouped. Keys of older entries ('contact', 'instruction', 'other') are kept. */
export const VAULT_CATEGORIES: VaultCategory[] = [
  { key: 'bank', group: 'Banking & cash', label: 'Bank accounts', icon: 'business-outline', hint: 'Savings, current, NRE/NRO, salary accounts', nominee: true, extra: [last4, { key: 'branch', label: 'Branch' }] },
  { key: 'locker', group: 'Banking & cash', label: 'Bank lockers', icon: 'lock-closed-outline', hint: 'Locker number and where the key is', nominee: true, extra: [{ key: 'lockerNo', label: 'Locker number' }, { key: 'key', label: 'Where is the key' }] },
  { key: 'cash', group: 'Banking & cash', label: 'Cash at home', icon: 'cash-outline', hint: 'Where cash is kept' },
  { key: 'deposit', group: 'Banking & cash', label: 'Fixed & recurring deposits', icon: 'time-outline', hint: 'FDs, RDs, post office deposits', nominee: true, extra: [{ key: 'maturity', label: 'Maturity date' }] },
  { key: 'mutual_fund', group: 'Investments', label: 'Mutual funds & SIPs', icon: 'trending-up-outline', hint: 'Folio, app or advisor', nominee: true, extra: [{ key: 'platform', label: 'App / advisor', placeholder: 'e.g. Groww, Kuvera, bank' }] },
  { key: 'stocks', group: 'Investments', label: 'Shares (demat)', icon: 'stats-chart-outline', hint: 'Broker and demat account', nominee: true, extra: [{ key: 'broker', label: 'Broker', placeholder: 'e.g. Zerodha' }] },
  { key: 'foreign_stocks', group: 'Investments', label: 'Foreign stocks, ESOP & RSU', icon: 'globe-outline', hint: 'US shares, employer stock plans', nominee: true, extra: [{ key: 'broker', label: 'Broker / plan', placeholder: 'e.g. Vested, E*TRADE, employer plan' }, { key: 'country', label: 'Country' }] },
  { key: 'nps', group: 'Investments', label: 'NPS & pension funds', icon: 'umbrella-outline', hint: 'PRAN and pension plans', nominee: true, extra: [last4] },
  { key: 'bonds', group: 'Investments', label: 'Bonds & savings schemes', icon: 'ribbon-outline', hint: 'Sovereign gold bonds, NSC, KVP, SCSS', nominee: true },
  { key: 'crypto', group: 'Investments', label: 'Crypto', icon: 'logo-bitcoin', hint: 'Exchange or wallet. Never write keys or passwords here.', extra: [{ key: 'platform', label: 'Exchange / wallet' }] },
  { key: 'gold', group: 'Gold, property & vehicles', label: 'Gold & jewellery', icon: 'diamond-outline', hint: 'Weight and where it is kept', extra: [{ key: 'grams', label: 'Weight (grams)' }] },
  { key: 'property', group: 'Gold, property & vehicles', label: 'Land, house & flats', icon: 'home-outline', hint: 'Address and where the documents are', extra: [{ key: 'address', label: 'Address / location' }] },
  { key: 'vehicle', group: 'Gold, property & vehicles', label: 'Vehicles', icon: 'car-outline', hint: 'Registration and where the RC is', extra: [{ key: 'regNo', label: 'Registration number' }] },
  { key: 'epf', group: 'Job & retirement', label: 'EPF / PF', icon: 'briefcase-outline', hint: 'UAN and employer', nominee: true, extra: [{ key: 'uan', label: 'UAN (last 4 digits)' }, { key: 'employer', label: 'Employer' }] },
  { key: 'ppf', group: 'Job & retirement', label: 'PPF', icon: 'shield-outline', hint: 'Bank or post office', nominee: true, extra: [last4] },
  { key: 'gratuity', group: 'Job & retirement', label: 'Gratuity / end-of-service', icon: 'cash-outline', hint: 'Employer and HR contact', extra: [{ key: 'employer', label: 'Employer' }] },
  { key: 'employer_benefit', group: 'Job & retirement', label: 'Employer death benefit & group life cover', icon: 'people-outline', hint: 'Group life, death-in-service benefit', nominee: true, extra: [{ key: 'employer', label: 'Employer' }] },
  { key: 'pension', group: 'Job & retirement', label: 'Pension', icon: 'hourglass-outline', hint: 'Government or private pension', nominee: true },
  { key: 'term', group: 'Insurance', label: 'Term insurance', icon: 'shield-checkmark-outline', hint: 'Insurer, policy number, cover', nominee: true, extra: [{ key: 'policyNo', label: 'Policy number' }] },
  { key: 'life', group: 'Insurance', label: 'Life insurance (LIC etc.)', icon: 'heart-outline', hint: 'Endowment, money-back, ULIP', nominee: true, extra: [{ key: 'policyNo', label: 'Policy number' }] },
  { key: 'health', group: 'Insurance', label: 'Health / medical insurance', icon: 'medkit-outline', hint: 'Policy number and cashless helpline', extra: [{ key: 'policyNo', label: 'Policy number' }, { key: 'helpline', label: 'Cashless / TPA helpline' }] },
  { key: 'accident', group: 'Insurance', label: 'Accident & other insurance', icon: 'bandage-outline', hint: 'Personal accident, travel, home, vehicle', nominee: true, extra: [{ key: 'policyNo', label: 'Policy number' }] },
  { key: 'credit_card', group: 'What we owe', label: 'Credit cards', icon: 'card-outline', hint: 'Who to inform, what is owed', extra: [last4] },
  { key: 'loan', group: 'What we owe', label: 'Loans', icon: 'document-text-outline', hint: 'Home, car, personal, gold loans', extra: [{ key: 'lender', label: 'Lender' }] },
  { key: 'borrowed', group: 'What we owe', label: 'Money borrowed from people', icon: 'arrow-down-circle-outline', hint: 'From relatives and friends' },
  { key: 'lent', group: 'Owed to us', label: 'Money lent to people', icon: 'arrow-up-circle-outline', hint: 'So the family can collect it' },
  { key: 'deposits_back', group: 'Owed to us', label: 'Deposits to get back', icon: 'return-down-back-outline', hint: 'Rent, utility, school deposits' },
  { key: 'will', group: 'Important papers', label: 'Will', icon: 'create-outline', hint: 'Where the will is and who the executor is' },
  { key: 'id_docs', group: 'Important papers', label: 'Passports, visas & IDs', icon: 'id-card-outline', hint: 'Passport, visa, Emirates ID, Aadhaar, PAN' },
  { key: 'certificates', group: 'Important papers', label: 'Certificates', icon: 'school-outline', hint: 'Birth, marriage, education' },
  { key: 'contact', group: 'People to call', label: 'Who to call first', icon: 'call-outline', hint: 'Name, relation and phone' },
  { key: 'professionals', group: 'People to call', label: 'Advisors & helpers', icon: 'person-outline', hint: 'CA, lawyer, insurance agent, employer HR' },
  { key: 'instruction', group: 'My message', label: 'First steps & a note for my family', icon: 'chatbox-ellipses-outline', hint: 'What to do first, and anything you want to say' },
  { key: 'other', group: 'My message', label: 'Anything else', icon: 'folder-outline', hint: 'Anything else the family should know' },
];

export const VAULT_GROUPS = [...new Set(VAULT_CATEGORIES.map((c) => c.group))];

/** Built-in topics plus the family's own topics (and groups) from Settings. */
export function allCategories(data: AppData): VaultCategory[] {
  return [...VAULT_CATEGORIES, ...(data.settings.vaultCustom ?? []).map((c) => ({ ...c, icon: 'bookmark-outline', hint: 'Your own topic', nominee: true }))];
}
export const allGroups = (cats: VaultCategory[]) => [...new Set(cats.map((c) => c.group))];

/** Entries whose topic no longer exists (retired keys, deleted custom topics) show under "Anything else". */
export const categoryOf = (e: VaultEntry, cats: VaultCategory[] = VAULT_CATEGORIES) => (cats.some((c) => c.key === e.section) ? e.section : 'other');

/** Items the app already knows about, shown in the vault without typing. */
export interface AutoItem {
  linkedId: string;
  section: string;
  title: string;
  value?: number;
  nominee?: string;
  extra?: Record<string, string>;
}

const POLICY_SECTION: Record<string, string> = { term: 'term', life: 'life', health: 'health', vehicle: 'accident', home: 'accident', travel: 'accident', other: 'accident' };

export function autoItems(data: AppData): AutoItem[] {
  const bal = computeBalances(data.accounts, data.transactions);
  const out: AutoItem[] = [];
  const bySection: Record<string, string> = { bank: 'bank', wallet: 'bank', cash: 'cash', deposit: 'deposit', investment: 'mutual_fund', gold: 'gold', property: 'property', credit_card: 'credit_card', loan: 'loan' };
  for (const a of data.accounts) {
    const section = bySection[a.type];
    if (!section || a.archived) continue;
    const owed = a.type === 'credit_card' || a.type === 'loan';
    out.push({ linkedId: a.id, section, title: a.name, value: Math.round(owed ? Math.max(0, -(bal[a.id] ?? 0)) : bal[a.id] ?? 0), extra: a.goldGrams ? { grams: String(a.goldGrams) } : undefined });
  }
  for (const p of data.policies) out.push({ linkedId: p.id, section: POLICY_SECTION[p.type] ?? 'accident', title: `${p.name}${p.insurer ? ` (${p.insurer})` : ''}`, value: p.sumAssured, nominee: p.nominee, extra: p.policyNo ? { policyNo: p.policyNo } : undefined });
  for (const v of data.vehicles) out.push({ linkedId: v.id, section: 'vehicle', title: v.name, extra: v.regNo ? { regNo: v.regNo } : undefined });
  for (const d of data.documents) out.push({ linkedId: d.id, section: 'id_docs', title: d.name });
  for (const p of personBalances(data.transactions)) {
    if (p.balance) out.push({ linkedId: `person:${p.person}`, section: p.balance > 0 ? 'lent' : 'borrowed', title: p.person, value: Math.abs(p.balance) });
  }
  return out;
}

/** One row per item: the user's entry, or the app's item with any details the user added to it. */
export interface VaultRow {
  key: string;
  section: string;
  title: string;
  entry?: VaultEntry;
  auto?: AutoItem;
  nominee?: string;
  value?: number;
  extra?: Record<string, string>;
}

export function vaultRows(data: AppData): VaultRow[] {
  const linked = new Map(data.vault.filter((e) => e.linkedId).map((e) => [e.linkedId!, e]));
  const rows: VaultRow[] = autoItems(data).map((a) => {
    const e = linked.get(a.linkedId);
    return { key: a.linkedId, section: a.section, title: a.title, auto: a, entry: e, nominee: e?.nominee || a.nominee, value: e?.value ?? a.value, extra: { ...a.extra, ...e?.extra } };
  });
  const autoIds = new Set(rows.map((r) => r.key));
  const cats = allCategories(data);
  for (const e of data.vault) {
    if (e.linkedId && autoIds.has(e.linkedId)) continue;
    rows.push({ key: e.id, section: categoryOf(e, cats), title: e.title, entry: e, nominee: e.nominee, value: e.value, extra: e.extra });
  }
  return rows;
}

export interface Readiness {
  /** 0–100: share of categories that have an item or are marked "I don't have this". */
  percent: number;
  done: number;
  total: number;
  /** Items in nominee categories with no nominee recorded. */
  missingNominee: VaultRow[];
  /** Items with no "where to find it". */
  missingWhere: VaultRow[];
}

export function readiness(data: AppData, rows = vaultRows(data)): Readiness {
  const na = new Set(data.settings.vaultNA ?? []);
  const has = new Set(rows.map((r) => r.section));
  const cats = allCategories(data);
  const done = cats.filter((c) => has.has(c.key) || na.has(c.key)).length;
  const nomineeCats = new Set(cats.filter((c) => c.nominee).map((c) => c.key));
  return {
    percent: Math.round((done / cats.length) * 100),
    done,
    total: cats.length,
    missingNominee: rows.filter((r) => nomineeCats.has(r.section) && !r.nominee),
    missingWhere: rows.filter((r) => !r.entry?.where && !['contact', 'professionals', 'instruction', 'other', 'borrowed', 'lent'].includes(r.section)),
  };
}

/** True when a note looks like it holds a secret that should never be stored or shared. */
export function looksSecret(text: string): boolean {
  return /\b(pin|password|passcode|cvv|otp|mpin|upi pin)\b/i.test(text) || /\d{12,19}/.test(text.replace(/(\d)[\s-]+(?=\d)/g, '$1'));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Printable family file: "Start here" first, then each category the family has. */
export function vaultHtml(data: AppData, money: (n: number) => string, owner: string, on: Date): string {
  const rows = vaultRows(data);
  const cats = allCategories(data);
  const field = (label: string, v?: string) => (v ? `<div class="f"><b>${esc(label)}:</b> ${esc(v)}</div>` : '');
  const card = (r: VaultRow) => {
    const cat = cats.find((c) => c.key === r.section);
    return `<div class="item"><div class="t">${esc(r.title)}${r.value ? ` <span class="v">${esc(money(r.value))}</span>` : ''}</div>
      ${field('Holder', r.entry?.holder)}${field('Nominee', r.nominee)}${field('Where to find it', r.entry?.where)}${field('Contact', r.entry?.contact)}
      ${(cat?.extra ?? []).map((x) => field(x.label, r.extra?.[x.key])).join('')}${field('Note', r.entry?.detail)}</div>`;
  };
  const firstSteps = rows.filter((r) => r.section === 'instruction');
  const callFirst = rows.filter((r) => r.section === 'contact');
  const sections = allGroups(cats).map((g) => {
    const body = cats
      .filter((c) => c.group === g && !['instruction', 'contact'].includes(c.key))
      .map((c) => {
        const items = rows.filter((r) => r.section === c.key);
        return items.length ? `<h3>${esc(c.label)}</h3>${items.map(card).join('')}` : '';
      })
      .join('');
    return body ? `<h2>${esc(g)}</h2>${body}` : '';
  }).join('');
  return `<html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#1d2b25;margin:28px;font-size:12px}
    h1{color:#0B6E4F;margin:0 0 4px}h2{color:#0B6E4F;border-bottom:2px solid #0B6E4F;padding-bottom:4px;margin-top:24px}h3{margin:14px 0 6px}
    .start{background:#E8F5EE;border-radius:10px;padding:14px;margin:14px 0}.item{border:1px solid #dde5e1;border-radius:8px;padding:8px 10px;margin:6px 0;page-break-inside:avoid}
    .t{font-weight:700;font-size:13px}.v{float:right;color:#0B6E4F}.f{margin-top:2px}.muted{color:#6b7a73}
  </style></head><body>
    <h1>What my family should know</h1>
    <div class="muted">Prepared by ${esc(owner)} with FamilyFin on ${on.toDateString()}. Keep this file private.</div>
    <div class="start"><h2 style="margin-top:0;border:none">Start here</h2>
      ${firstSteps.length ? firstSteps.map((r) => `<p><b>${esc(r.title)}</b><br>${esc(r.entry?.detail ?? '')}</p>`).join('') : '<p>Call the people below first.</p>'}
      ${callFirst.length ? `<h3>Who to call first</h3>${callFirst.map((r) => `<div>📞 <b>${esc(r.title)}</b> ${esc(r.entry?.contact ?? '')} ${esc(r.entry?.detail ?? '')}</div>`).join('')}` : ''}
    </div>
    ${sections}
    <p class="muted" style="margin-top:24px">Never share PINs or passwords. Account numbers show only the last 4 digits.</p>
  </body></html>`;
}
