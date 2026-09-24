// Rehydration: restore placeholders in the external AI's reply using the local vault.
// Tolerant to case, spacing and bracket changes. Secrets are never restored by default.

import type { VaultEntry } from './masking';

export type RehydrateSegment =
  | { kind: 'text'; text: string }
  | { kind: 'restored'; placeholder: string; raw: string; value: string }
  | { kind: 'secret'; placeholder: string; raw: string }
  | { kind: 'unresolved'; raw: string };

export interface RehydrateResult {
  text: string;
  segments: RehydrateSegment[];
  restoredCount: number;
  secretsKept: number;
  unresolved: string[];
}

// ⟦EMP_01⟧, ⟦ emp_01 ⟧, [[EMP_01]], ⟦EMP 01⟧
const TOKEN = /⟦\s*([A-Za-z][A-Za-z0-9_ ]{0,40}?)\s*⟧|\[\[\s*([A-Za-z][A-Za-z0-9_ ]{0,40}?)\s*\]\]/g;

const canon = (inner: string) => inner.trim().toUpperCase().replace(/[\s_]+/g, '_');

export function rehydrate(reply: string, vault: VaultEntry[], opts: { restoreSecrets?: boolean } = {}): RehydrateResult {
  const byKey = new Map(vault.map((e) => [canon(e.placeholder.slice(1, -1)), e]));
  const segments: RehydrateSegment[] = [];
  const unresolved: string[] = [];
  let restoredCount = 0;
  let secretsKept = 0;
  let cursor = 0;
  let text = '';

  for (const m of reply.matchAll(TOKEN)) {
    const start = m.index!;
    if (start > cursor) segments.push({ kind: 'text', text: reply.slice(cursor, start) });
    text += reply.slice(cursor, start);
    const raw = m[0];
    const entry = byKey.get(canon(m[1] ?? m[2] ?? ''));
    if (!entry) {
      segments.push({ kind: 'unresolved', raw });
      unresolved.push(raw);
      text += raw;
    } else if (entry.secret && !opts.restoreSecrets) {
      segments.push({ kind: 'secret', placeholder: entry.placeholder, raw });
      secretsKept++;
      text += entry.placeholder;
    } else {
      segments.push({ kind: 'restored', placeholder: entry.placeholder, raw, value: entry.original });
      restoredCount++;
      text += entry.original;
    }
    cursor = start + raw.length;
  }
  if (cursor < reply.length) {
    segments.push({ kind: 'text', text: reply.slice(cursor) });
    text += reply.slice(cursor);
  }
  return { text, segments, restoredCount, secretsKept, unresolved };
}
