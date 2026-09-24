// Context-preserving masking. Deterministic replacement driven by structured findings.
// The LLM never rewrites text; this module does all replacements.

import type { Category } from '../data/types';

export interface MaskTarget {
  original: string;
  entityType: string;
  category?: Category;
  /** Extra surface forms that map to the same placeholder (added by verification repair). */
  aliases?: string[];
}

export interface VaultEntry {
  placeholder: string; // e.g. ⟦EMP_01⟧
  original: string;
  aliases: string[];
  entityType: string;
  category?: Category;
  secret: boolean;
}

export interface Replacement {
  start: number; // offsets in the ORIGINAL text
  end: number;
  matched: string;
  placeholder: string;
}

export interface MaskResult {
  text: string;
  vault: VaultEntry[];
  replacements: Replacement[];
}

export const PH_OPEN = '⟦';
export const PH_CLOSE = '⟧';

const SECRET_TYPES = new Set(['SECRET', 'HONEYTOKEN', 'PASSWORD', 'API_KEY']);

type Numbering = 'pad2' | 'letter' | 'plain';

const PREFIXES: Record<string, { prefix: string; numbering: Numbering }> = {
  PERSON: { prefix: 'EMP', numbering: 'pad2' },
  EMPLOYEE: { prefix: 'EMP', numbering: 'pad2' },
  CUSTOMER: { prefix: 'CUSTOMER', numbering: 'pad2' },
  CLIENT: { prefix: 'CLIENT', numbering: 'letter' },
  ORG: { prefix: 'ORG', numbering: 'letter' },
  PROJECT: { prefix: 'PROJECT', numbering: 'pad2' },
  SECRET: { prefix: 'SECRET', numbering: 'plain' },
  PASSWORD: { prefix: 'SECRET', numbering: 'plain' },
  API_KEY: { prefix: 'SECRET', numbering: 'plain' },
  HONEYTOKEN: { prefix: 'SECRET', numbering: 'plain' },
  INTERNAL_HOST: { prefix: 'INTERNAL_HOST', numbering: 'plain' },
  DEAL_VALUE: { prefix: 'DEAL_VALUE', numbering: 'plain' },
};

export function isSecretType(entityType: string): boolean {
  return SECRET_TYPES.has(entityType);
}

function prefixFor(entityType: string) {
  return PREFIXES[entityType] ?? { prefix: entityType.toUpperCase().replace(/[^A-Z]+/g, '_'), numbering: 'plain' as Numbering };
}

function formatIndex(n: number, numbering: Numbering): string {
  if (numbering === 'pad2') return String(n).padStart(2, '0');
  if (numbering === 'letter') {
    let s = '';
    let k = n;
    while (k > 0) {
      const r = (k - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      k = Math.floor((k - 1) / 26);
    }
    return s;
  }
  return String(n);
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}_]/u.test(ch);

/** All occurrences of `term` in `text` that are not glued to other word characters. */
export function findOccurrences(text: string, term: string, caseInsensitive = false): number[] {
  if (!term) return [];
  const hay = caseInsensitive ? text.toLowerCase() : text;
  const needle = caseInsensitive ? term.toLowerCase() : term;
  const out: number[] = [];
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const before = text[i - 1];
    const after = text[i + term.length];
    const okStart = !isWordChar(term[0]) || !isWordChar(before);
    const okEnd = !isWordChar(term[term.length - 1]) || !isWordChar(after);
    if (okStart && okEnd) out.push(i);
    i = hay.indexOf(needle, i + 1);
  }
  return out;
}

/**
 * Replace every occurrence of every target (and its aliases) with a role-preserving placeholder.
 * - Longest span wins on overlap.
 * - Placeholders are numbered per prefix in order of first appearance.
 * - The same original always maps to the same placeholder (relationship-preserving).
 */
export function mask(content: string, targets: MaskTarget[]): MaskResult {
  // Merge targets that share the same original.
  const byOriginal = new Map<string, MaskTarget & { aliases: string[] }>();
  for (const t of targets) {
    if (!t.original) continue;
    const existing = byOriginal.get(t.original);
    if (existing) {
      for (const a of t.aliases ?? []) if (!existing.aliases.includes(a)) existing.aliases.push(a);
    } else {
      byOriginal.set(t.original, { ...t, aliases: [...(t.aliases ?? [])] });
    }
  }

  // Candidate spans, longest term first so longer spans claim text before shorter ones.
  const terms: { term: string; original: string }[] = [];
  for (const t of byOriginal.values()) {
    terms.push({ term: t.original, original: t.original });
    for (const a of t.aliases) if (a && a !== t.original) terms.push({ term: a, original: t.original });
  }
  terms.sort((a, b) => b.term.length - a.term.length);

  const claimed: { start: number; end: number; matched: string; original: string }[] = [];
  for (const { term, original } of terms) {
    for (const start of findOccurrences(content, term)) {
      const end = start + term.length;
      if (claimed.some((c) => start < c.end && c.start < end)) continue;
      claimed.push({ start, end, matched: term, original });
    }
  }
  claimed.sort((a, b) => a.start - b.start);

  // Assign placeholders by first appearance.
  const counters = new Map<string, number>();
  const vaultByOriginal = new Map<string, VaultEntry>();
  for (const c of claimed) {
    if (vaultByOriginal.has(c.original)) continue;
    const t = byOriginal.get(c.original)!;
    const { prefix, numbering } = prefixFor(t.entityType);
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    vaultByOriginal.set(c.original, {
      placeholder: `${PH_OPEN}${prefix}_${formatIndex(n, numbering)}${PH_CLOSE}`,
      original: t.original,
      aliases: t.aliases,
      entityType: t.entityType,
      category: t.category,
      secret: isSecretType(t.entityType),
    });
  }

  let text = '';
  let cursor = 0;
  const replacements: Replacement[] = [];
  for (const c of claimed) {
    const placeholder = vaultByOriginal.get(c.original)!.placeholder;
    text += content.slice(cursor, c.start) + placeholder;
    cursor = c.end;
    replacements.push({ start: c.start, end: c.end, matched: c.matched, placeholder });
  }
  text += content.slice(cursor);

  return { text, vault: [...vaultByOriginal.values()], replacements };
}

// ---------------------------------------------------------------- structured data

export interface TableData {
  columns: string[];
  rows: Record<string, string | number>[];
}

export function tableToCsv(t: TableData): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns.join(','), ...t.rows.map((r) => t.columns.map((c) => esc(r[c] ?? '')).join(','))].join('\n');
}

/** Data minimisation for tables: keep only the listed columns. Returns the kept table and every dropped value. */
export function minimiseTable(t: TableData, keep: string[]): { table: TableData; droppedValues: string[] } {
  const columns = t.columns.filter((c) => keep.includes(c));
  const rows = t.rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]])) as Record<string, string | number>);
  const droppedValues = t.rows.flatMap((r) => t.columns.filter((c) => !keep.includes(c)).map((c) => String(r[c])));
  return { table: { columns, rows }, droppedValues };
}
