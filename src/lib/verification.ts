// Fast local verification. Deterministic; no second LLM pass.
// Checks the sanitised text for vault leaks, variant leaks, residual patterns,
// malformed placeholders and inconsistent mappings; auto-repairs once.

import { findOccurrences, mask, PH_CLOSE, PH_OPEN, type MaskResult, type MaskTarget, type VaultEntry } from './masking';
import { normalise, scanRules, type RuleMatch } from './rules';

export type CheckId = 'vault' | 'variants' | 'patterns' | 'placeholders' | 'consistency';

export interface VerificationCheck {
  id: CheckId;
  label: string;
  passed: boolean;
  detail: string;
}

export interface Leak {
  /** Text as it appears in the sanitised output (may include a possessive). */
  found: string;
  /** Surface form to add to the vault as an alias. */
  alias: string;
  placeholder: string;
  original: string;
  kind: 'original' | 'alias' | 'dropped' | 'first name' | 'surname' | 'possessive' | 'spacing variant' | 'initials' | 'email local part' | 'short form';
}

export interface VerifyResult {
  passed: boolean;
  checks: VerificationCheck[];
  leaks: Leak[];
  patternLeaks: RuleMatch[];
}

export interface VerifyOptions {
  /** Values removed by data minimisation that must never appear. */
  droppedValues?: string[];
}

const PERSON_TYPES = new Set(['PERSON', 'EMPLOYEE', 'CUSTOMER']);
const ORG_TYPES = new Set(['CLIENT', 'ORG']);
const ORG_SUFFIXES = /^(corp|corporation|ltd|limited|inc|pvt|llp|llc|co|traders|group|holdings)\.?$/i;

/** Surface-form variants of a vault value that would still identify it. */
export function variantsOf(entry: Pick<VaultEntry, 'original' | 'entityType'>): { value: string; kind: Leak['kind'] }[] {
  const v = entry.original;
  const out: { value: string; kind: Leak['kind'] }[] = [];
  const push = (value: string, kind: Leak['kind']) => {
    if (value && value !== v && value.length >= 3 && !out.some((o) => o.value.toLowerCase() === value.toLowerCase())) out.push({ value, kind });
  };
  const words = v.split(/\s+/).filter(Boolean);

  if (PERSON_TYPES.has(entry.entityType) && words.length >= 2) {
    push(words[0], 'first name');
    push(words[words.length - 1], 'surname');
    push(`${words[0][0]}. ${words[words.length - 1]}`, 'initials');
  }
  if (ORG_TYPES.has(entry.entityType) && words.length >= 2) {
    const core = words.filter((w) => !ORG_SUFFIXES.test(w));
    if (core.length && core.length < words.length) push(core.join(' '), 'short form');
  }
  if (entry.entityType === 'PROJECT' && words.length >= 2 && /^project$/i.test(words[0])) {
    push(words.slice(1).join(' '), 'short form');
  }
  if (entry.entityType === 'EMAIL' && v.includes('@')) push(v.split('@')[0], 'email local part');
  if (entry.entityType === 'INTERNAL_HOST' && v.includes('.')) {
    const short = v.split('.')[0];
    if (short.length >= 4) push(short, 'short form');
  }
  if (entry.entityType === 'DEAL_VALUE') {
    const stripped = v.replace(/^(₹|Rs\.?|INR)\s*/i, '');
    push(stripped, 'short form');
    push(stripped.replace(/\bCr\b/i, 'crore'), 'short form');
  }
  if (words.length >= 2) {
    push(words.join('-'), 'spacing variant');
    push(words.join(''), 'spacing variant');
    push(words.join('_'), 'spacing variant');
  }
  if (v.includes('-')) {
    push(v.replace(/-/g, ' '), 'spacing variant');
    push(v.replace(/-/g, ''), 'spacing variant');
  }
  return out;
}

const PLACEHOLDER_ANY = new RegExp(`${PH_OPEN}[^${PH_OPEN}${PH_CLOSE}]*${PH_CLOSE}`, 'g');
const PLACEHOLDER_STRICT = new RegExp(`^${PH_OPEN}[A-Z]+(?:_[A-Z]+)*_(?:\\d+|[A-Z]+)${PH_CLOSE}$`);

function possessiveAt(text: string, end: number): string {
  const tail = text.slice(end, end + 2);
  return tail === "'s" || tail === '’s' ? tail : '';
}

export function verify(text: string, vault: VaultEntry[], opts: VerifyOptions = {}): VerifyResult {
  const leaks: Leak[] = [];
  const seen = new Set<string>();
  const addLeak = (l: Leak) => {
    const key = `${l.placeholder}|${l.found.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      leaks.push(l);
    }
  };

  // 1. Vault values (originals + aliases) and minimised-away values
  for (const e of vault) {
    for (const [term, kind] of [[e.original, 'original'] as const, ...e.aliases.map((a) => [a, 'alias'] as const)]) {
      for (const i of findOccurrences(text, term, true)) {
        const found = text.slice(i, i + term.length);
        addLeak({ found, alias: found, placeholder: e.placeholder, original: e.original, kind });
      }
    }
  }
  for (const d of opts.droppedValues ?? []) {
    for (const i of findOccurrences(text, d, true)) {
      addLeak({ found: text.slice(i, i + d.length), alias: d, placeholder: '', original: d, kind: 'dropped' });
    }
  }
  const vaultLeakCount = leaks.length;

  // 2. Variants (longest first, so "Rahul-Mehta" is one leak rather than three)
  const claimed: [number, number][] = [];
  for (const e of vault) {
    if (e.secret) continue; // secrets are covered by the pattern re-scan
    const known = new Set([e.original, ...e.aliases].map((s) => s.toLowerCase()));
    const variants = variantsOf(e).sort((a, b) => b.value.length - a.value.length);
    for (const variant of variants) {
      if (known.has(variant.value.toLowerCase())) continue;
      for (const i of findOccurrences(text, variant.value, true)) {
        const end = i + variant.value.length;
        if (claimed.some(([s, t]) => i < t && s < end)) continue;
        claimed.push([i, end]);
        const base = text.slice(i, i + variant.value.length);
        const poss = possessiveAt(text, i + variant.value.length);
        addLeak({
          found: base + poss,
          alias: base,
          placeholder: e.placeholder,
          original: e.original,
          kind: poss ? 'possessive' : variant.kind,
        });
      }
    }
  }
  const variantLeaks = leaks.slice(vaultLeakCount);

  // 3. Known sensitive patterns (rules re-run on normalised output)
  const patternLeaks = scanRules(normalise(text).text);

  // 4. Placeholders well-formed and present in vault
  const placeholders = new Set(vault.map((e) => e.placeholder));
  const found = text.match(PLACEHOLDER_ANY) ?? [];
  const badPh = found.filter((p) => !PLACEHOLDER_STRICT.test(p) || !placeholders.has(p));
  const opens = text.split(PH_OPEN).length - 1;
  const closes = text.split(PH_CLOSE).length - 1;
  const bracketsBalanced = opens === closes && opens === found.length;

  // 5. Consistent mappings: one original ↔ one placeholder
  const phCount = new Map<string, number>();
  const formOwner = new Map<string, string>();
  let consistent = true;
  for (const e of vault) {
    phCount.set(e.placeholder, (phCount.get(e.placeholder) ?? 0) + 1);
    for (const form of [e.original, ...e.aliases]) {
      const owner = formOwner.get(form);
      if (owner && owner !== e.placeholder) consistent = false;
      formOwner.set(form, e.placeholder);
    }
  }
  if ([...phCount.values()].some((n) => n > 1)) consistent = false;

  const quote = (l: Leak) => `"${l.found}"`;
  const checks: VerificationCheck[] = [
    {
      id: 'vault',
      label: 'No vault value in output',
      passed: vaultLeakCount === 0,
      detail:
        vaultLeakCount === 0
          ? `${vault.length} vault value${vault.length === 1 ? '' : 's'}${opts.droppedValues?.length ? ` + ${opts.droppedValues.length} dropped values` : ''} absent`
          : `Found ${leaks.slice(0, vaultLeakCount).map(quote).join(', ')}`,
    },
    {
      id: 'variants',
      label: 'No variant of a vault value',
      passed: variantLeaks.length === 0,
      detail:
        variantLeaks.length === 0
          ? 'First name, surname, possessive, spacing and short-form variants absent'
          : variantLeaks.map((l) => `${quote(l)} (${l.kind} of ${l.placeholder})`).join(', '),
    },
    {
      id: 'patterns',
      label: 'No known sensitive patterns remain',
      passed: patternLeaks.length === 0,
      detail: patternLeaks.length === 0 ? 'L0 + L1 re-scan on normalised output: clean' : patternLeaks.map((p) => `${p.label}: "${p.value}"`).join(', '),
    },
    {
      id: 'placeholders',
      label: 'Placeholders well-formed and in vault',
      passed: badPh.length === 0 && bracketsBalanced,
      detail: badPh.length === 0 && bracketsBalanced ? `${found.length} placeholder${found.length === 1 ? '' : 's'} resolved` : `Unresolved: ${badPh.join(', ') || 'unbalanced brackets'}`,
    },
    {
      id: 'consistency',
      label: 'Mappings consistent (1 original → 1 placeholder)',
      passed: consistent,
      detail: consistent ? `${vault.length} one-to-one mapping${vault.length === 1 ? '' : 's'}` : 'A value maps to more than one placeholder',
    },
  ];

  return { passed: checks.every((c) => c.passed), checks, leaks, patternLeaks };
}

// ---------------------------------------------------------------- auto-repair

export interface RepairAction {
  found: string;
  alias: string;
  placeholder: string;
  note: string;
}

export interface VerificationOutcome {
  status: 'PASS' | 'REPAIRED' | 'REVIEW';
  attempts: { mask: MaskResult; result: VerifyResult }[];
  repairs: RepairAction[];
  final: MaskResult;
  targets: MaskTarget[];
}

/** Mask, verify, and if anything leaks add it to the vault under the right placeholder, re-mask and re-verify once. */
export function maskAndVerify(content: string, targets: MaskTarget[], opts: VerifyOptions = {}): VerificationOutcome {
  const first = mask(content, targets);
  const r1 = verify(first.text, first.vault, opts);
  if (r1.passed) return { status: 'PASS', attempts: [{ mask: first, result: r1 }], repairs: [], final: first, targets };

  const repaired: MaskTarget[] = targets.map((t) => ({ ...t, aliases: [...(t.aliases ?? [])] }));
  const repairs: RepairAction[] = [];
  for (const leak of r1.leaks) {
    if (leak.kind === 'dropped') {
      repaired.push({ original: leak.original, entityType: 'DROPPED' });
      repairs.push({ found: leak.found, alias: leak.original, placeholder: '(new)', note: 'Dropped value reappeared; masked' });
      continue;
    }
    const target = repaired.find((t) => t.original === leak.original);
    if (target && !target.aliases!.includes(leak.alias) && leak.alias !== target.original) {
      target.aliases!.push(leak.alias);
      repairs.push({ found: leak.found, alias: leak.alias, placeholder: leak.placeholder, note: `Added "${leak.alias}" to vault as ${leak.kind} of ${leak.placeholder}` });
    }
  }
  for (const p of r1.patternLeaks) {
    if (repaired.some((t) => t.original === p.value)) continue;
    repaired.push({ original: p.value, entityType: p.entityType, category: p.primaryCategory });
    repairs.push({ found: p.value, alias: p.value, placeholder: '(new)', note: `${p.label} masked on re-scan` });
  }

  const second = mask(content, repaired);
  const r2 = verify(second.text, second.vault, opts);
  return {
    status: r2.passed ? 'REPAIRED' : 'REVIEW',
    attempts: [
      { mask: first, result: r1 },
      { mask: second, result: r2 },
    ],
    repairs,
    final: second,
    targets: repaired,
  };
}
