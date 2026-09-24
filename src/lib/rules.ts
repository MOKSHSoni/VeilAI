// Deterministic detectors (L0 honeytokens + L1 rules) and the input normaliser.
// This file runs for real: regex, checksums (Luhn, Verhoeff), hashing.

import type { Category, RiskLevel } from '../data/types';

export type RuleId =
  | 'EMAIL'
  | 'INDIAN_PHONE'
  | 'AWS_ACCESS_KEY'
  | 'API_KEY'
  | 'PASSWORD'
  | 'AADHAAR'
  | 'PAN'
  | 'CARD'
  | 'INTERNAL_HOST'
  | 'PRIVATE_IP'
  | 'HONEYTOKEN';

export interface RuleMatch {
  rule: RuleId;
  label: string;
  value: string;
  start: number;
  end: number;
  entityType: string;
  primaryCategory: Category;
  labels: Category[];
  severity: RiskLevel;
  /** Present for honeytoken matches. */
  honeytokenId?: string;
}

// ---------------------------------------------------------------- checksums

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

const digitsOf = (s: string) => s.replace(/\D/g, '');

export function verhoeffValid(num: string): boolean {
  const digits = digitsOf(num);
  if (!digits) return false;
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(rev[i])]];
  return c === 0;
}

/** Check digit to append to `num` so that the result is Verhoeff-valid. */
export function verhoeffCheckDigit(num: string): number {
  let c = 0;
  const rev = digitsOf(num).split('').reverse();
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][Number(rev[i])]];
  return VERHOEFF_INV[c];
}

export function luhnValid(num: string): boolean {
  const digits = digitsOf(num);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------- honeytokens (L0)

/** FNV-1a 32-bit. Endpoints hold only hashes of planted tokens, never the tokens. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(s)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export interface HoneytokenRecord {
  id: string;
  hash: string;
  plantedIn: string;
}

export const HONEYTOKEN_REGISTRY: HoneytokenRecord[] = [
  { id: 'HT-0042', hash: '90132eb4', plantedIn: 'finance-reports repository config' },
];

function detectHoneytokens(text: string): RuleMatch[] {
  const out: RuleMatch[] = [];
  const re = /[^\s"'`,;=:()[\]{}<>]{8,}/g;
  for (const m of text.matchAll(re)) {
    const hash = fnv1a(m[0]);
    const rec = HONEYTOKEN_REGISTRY.find((r) => r.hash === hash);
    if (rec) {
      out.push({
        rule: 'HONEYTOKEN',
        label: `Honeytoken ${rec.id}`,
        value: m[0],
        start: m.index!,
        end: m.index! + m[0].length,
        entityType: 'HONEYTOKEN',
        primaryCategory: 'CREDENTIALS',
        labels: ['CREDENTIALS', 'SECURITY'],
        severity: 'CRITICAL',
        honeytokenId: rec.id,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- L1 rules

interface RuleDef {
  rule: RuleId;
  label: string;
  re: RegExp;
  /** Capture group holding the sensitive value (default: whole match). */
  group?: number;
  validate?: (v: string) => boolean;
  entityType: string;
  primaryCategory: Category;
  labels: Category[];
  severity: RiskLevel;
}

const NOT_PLACEHOLDER = (v: string) => !v.includes('⟦') && !v.includes('⟧');

const RULES: RuleDef[] = [
  {
    rule: 'AWS_ACCESS_KEY',
    label: 'AWS access key',
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    entityType: 'SECRET',
    primaryCategory: 'CREDENTIALS',
    labels: ['CREDENTIALS', 'SECURITY'],
    severity: 'CRITICAL',
  },
  {
    rule: 'API_KEY',
    label: 'API key',
    re: /\b(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{36}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    entityType: 'SECRET',
    primaryCategory: 'CREDENTIALS',
    labels: ['CREDENTIALS', 'SECURITY'],
    severity: 'CRITICAL',
  },
  {
    // quoted assignment:  DB_PASSWORD = "value"   /  "password": "value"
    rule: 'PASSWORD',
    label: 'Password / secret assignment',
    re: /(?:password|passwd|pwd|pass|secret|token|api[_-]?key)[\w-]*["']?\s*[:=]\s*(["'])([^"'\s]{4,})\1/gi,
    group: 2,
    validate: NOT_PLACEHOLDER,
    entityType: 'SECRET',
    primaryCategory: 'CREDENTIALS',
    labels: ['CREDENTIALS', 'SECURITY'],
    severity: 'CRITICAL',
  },
  {
    // YAML / env style:  db_pass: value
    rule: 'PASSWORD',
    label: 'Password / secret assignment',
    re: /(?:password|passwd|pwd|pass|secret|token|api[_-]?key)[\w-]*\s*:[ \t]*([^\s"'⟦]{6,})/gi,
    group: 1,
    validate: NOT_PLACEHOLDER,
    entityType: 'SECRET',
    primaryCategory: 'CREDENTIALS',
    labels: ['CREDENTIALS', 'SECURITY'],
    severity: 'CRITICAL',
  },
  {
    rule: 'EMAIL',
    label: 'Email address',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    entityType: 'EMAIL',
    primaryCategory: 'PERSONAL_INFORMATION',
    labels: ['PERSONAL_INFORMATION'],
    severity: 'MEDIUM',
  },
  {
    rule: 'CARD',
    label: 'Payment card (Luhn)',
    re: /(?<!\d[ -]?)\d(?:[ -]?\d){12,18}(?![ -]?\d)/g,
    validate: luhnValid,
    entityType: 'CARD',
    primaryCategory: 'FINANCIAL',
    labels: ['FINANCIAL', 'PERSONAL_INFORMATION'],
    severity: 'CRITICAL',
  },
  {
    rule: 'AADHAAR',
    label: 'Aadhaar-like number (Verhoeff)',
    re: /(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g,
    validate: verhoeffValid,
    entityType: 'NATIONAL_ID',
    primaryCategory: 'PERSONAL_INFORMATION',
    labels: ['PERSONAL_INFORMATION'],
    severity: 'HIGH',
  },
  {
    rule: 'INDIAN_PHONE',
    label: 'Indian mobile number',
    re: /(?<![\w+])(?:\+91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?![ -]?\d)/g,
    entityType: 'PHONE',
    primaryCategory: 'PERSONAL_INFORMATION',
    labels: ['PERSONAL_INFORMATION'],
    severity: 'MEDIUM',
  },
  {
    rule: 'PAN',
    label: 'PAN',
    re: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    entityType: 'NATIONAL_ID',
    primaryCategory: 'PERSONAL_INFORMATION',
    labels: ['PERSONAL_INFORMATION', 'FINANCIAL'],
    severity: 'HIGH',
  },
  {
    rule: 'INTERNAL_HOST',
    label: 'Internal hostname',
    re: /\b(?:[a-z0-9-]+\.)+(?:internal|corp|intranet|lan)\b/gi,
    entityType: 'INTERNAL_HOST',
    primaryCategory: 'SECURITY',
    labels: ['SECURITY'],
    severity: 'HIGH',
  },
  {
    rule: 'PRIVATE_IP',
    label: 'Private IP address',
    re: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
    entityType: 'INTERNAL_HOST',
    primaryCategory: 'SECURITY',
    labels: ['SECURITY'],
    severity: 'MEDIUM',
  },
];

/** Run L0 + L1 over already-normalised text. Overlaps resolve to the earliest, then longest, match. */
export function scanRules(text: string): RuleMatch[] {
  const all: RuleMatch[] = detectHoneytokens(text);
  for (const def of RULES) {
    for (const m of text.matchAll(def.re)) {
      const g = def.group ?? 0;
      const value = m[g];
      if (value === undefined) continue;
      if (def.validate && !def.validate(value)) continue;
      const start = m.index! + (g === 0 ? 0 : m[0].indexOf(value));
      all.push({
        rule: def.rule,
        label: def.label,
        value,
        start,
        end: start + value.length,
        entityType: def.entityType,
        primaryCategory: def.primaryCategory,
        labels: def.labels,
        severity: def.severity,
      });
    }
  }
  // Honeytokens win any overlap; otherwise earliest then longest.
  all.sort((a, b) =>
    a.rule === 'HONEYTOKEN' && b.rule !== 'HONEYTOKEN'
      ? -1
      : b.rule === 'HONEYTOKEN' && a.rule !== 'HONEYTOKEN'
        ? 1
        : a.start - b.start || b.end - b.start - (a.end - a.start),
  );
  const kept: RuleMatch[] = [];
  for (const m of all) {
    if (kept.some((k) => m.start < k.end && k.start < m.end)) continue;
    kept.push(m);
  }
  return kept.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- normaliser

export interface NormaliseNote {
  before: string;
  after: string;
  method: string;
}

const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', і: 'i', ј: 'j', ԁ: 'd', ѕ: 's',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
};

function decodeBase64(s: string): string | null {
  if (s.length % 4 !== 0) return null;
  try {
    const out = atob(s);
    if (out.length < 6) return null;
    if (!/^[\x20-\x7e]+$/.test(out)) return null;
    const alnum = out.replace(/[^A-Za-z0-9]/g, '').length;
    return alnum / out.length >= 0.6 ? out : null;
  } catch {
    return null;
  }
}

/** Defeats simple evasion: zero-width chars, homoglyphs, spaced-out characters, base64. */
export function normalise(input: string): { text: string; notes: NormaliseNote[] } {
  const notes: NormaliseNote[] = [];
  let text = input.normalize('NFKC');

  const zw = /[\u200B-\u200D\u2060\uFEFF]/g;
  if (zw.test(text)) {
    notes.push({ before: 'zero-width characters', after: '(removed)', method: 'Strip zero-width characters' });
    text = text.replace(zw, '');
  }

  text = text.replace(/[\u0400-\u04FF\u0500-\u052F]/g, (ch) => {
    const r = HOMOGLYPHS[ch];
    if (r) {
      notes.push({ before: ch, after: r, method: 'Fold homoglyph' });
      return r;
    }
    return ch;
  });

  text = text.replace(/(?<!\S)(?:[A-Za-z0-9_+/-] ){7,}[A-Za-z0-9_+/=-](?!\S)/g, (run) => {
    const after = run.replace(/ /g, '');
    notes.push({ before: run, after, method: 'Collapse spaced-out characters' });
    return after;
  });

  text = text.replace(/(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{12,}={0,2}(?![A-Za-z0-9+/=])/g, (cand) => {
    if (!/[0-9+/=]/.test(cand) && !/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/.test(cand)) return cand;
    const decoded = decodeBase64(cand);
    if (!decoded) return cand;
    notes.push({ before: cand, after: decoded, method: 'Decode base64' });
    return decoded;
  });

  return { text, notes };
}
