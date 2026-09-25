// Document Scan model: the simulated sample board pack, and user-added files scanned for real
// with rules.ts (L0 honeytokens + L1 rules), page by page. Nothing is uploaded anywhere.

import type { Category, LayerId, RiskLevel } from '../data/types';
import { DOCUMENT, DOC_PAGES } from '../data/documentScan';
import { normalise, scanRules } from './rules';

export interface PageFindingView {
  category: Category;
  entityType: string;
  /** Always redacted: never the full sensitive value. */
  evidence: string;
  layer: LayerId;
  /** Simulated model confidence (sample only). Rule matches have none. */
  confidence?: number;
  rule?: string;
}

export interface PageView {
  page: number;
  title: string;
  /** null = no rule matched (rules-only scan: NOT the same as SAFE). */
  level: RiskLevel | null;
  findings: PageFindingView[];
  l5Ran?: boolean;
  latencyMs: number;
}

export interface ScannedDoc {
  id: string;
  fileName: string;
  source: 'sample' | 'upload';
  sizeBytes: number;
  chars: number;
  pages: PageView[];
  scannedAt: string;
  /** Total latency: simulated for the sample, measured on this device for uploads. */
  totalMs: number;
}

export const PAGE_CHARS = 3000; // ~1 page, matches the chunking used by the detection layers
export const MAX_FILE_BYTES = 1024 * 1024;

export const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'log', 'yaml', 'yml', 'xml', 'html', 'htm', 'ini', 'cfg', 'conf',
  'env', 'toml', 'properties', 'sql', 'py', 'js', 'ts', 'tsx', 'jsx', 'java', 'kt', 'go', 'rs', 'rb', 'php', 'cs', 'c', 'h',
  'cpp', 'hpp', 'sh', 'ps1', 'bat', 'tf', 'rtf',
];
const BINARY_DOCS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'zip', 'png', 'jpg', 'jpeg', 'gif'];

export const ACCEPT_ATTR = TEXT_EXTENSIONS.map((e) => `.${e}`).join(',');

export type FileCheck = { ok: true } | { ok: false; reason: string };

export function checkFile(name: string, sizeBytes: number): FileCheck {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (BINARY_DOCS.includes(ext)) {
    return { ok: false, reason: `.${ext} files need a document parser that this prototype does not include. Save it as .txt and add that instead.` };
  }
  if (ext && !TEXT_EXTENSIONS.includes(ext) && !name.startsWith('.')) {
    return { ok: false, reason: `.${ext} is not a supported text format.` };
  }
  if (sizeBytes > MAX_FILE_BYTES) return { ok: false, reason: `File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  if (sizeBytes === 0) return { ok: false, reason: 'File is empty.' };
  return { ok: true };
}

/** Heuristic: NUL bytes or lots of replacement characters mean this is not really text. */
export function looksBinary(text: string): boolean {
  const sample = text.slice(0, 4000);
  if (sample.includes('\u0000')) return true;
  const bad = (sample.match(/\uFFFD/g) ?? []).length;
  return sample.length > 0 && bad / sample.length > 0.02;
}

/** Split into ~1-page chunks: form feeds if present, otherwise on line boundaries. */
export function splitPages(text: string, pageChars = PAGE_CHARS): string[] {
  if (text.includes('\f')) return text.split('\f').filter((p) => p.trim());
  const pages: string[] = [];
  let cur = '';
  for (const line of text.split(/(?<=\n)/)) {
    if (cur && cur.length + line.length > pageChars) {
      pages.push(cur);
      cur = '';
    }
    // a single very long line is hard-wrapped
    let rest = line;
    while (rest.length > pageChars) {
      pages.push(rest.slice(0, pageChars));
      rest = rest.slice(pageChars);
    }
    cur += rest;
  }
  if (cur.trim() || pages.length === 0) pages.push(cur);
  return pages;
}

/** Keep the shape, hide the value: "AKIAQ7X3…" → "AK••••••••2P". */
export function redact(value: string): string {
  const v = value.trim();
  if (v.length <= 6) return '•'.repeat(Math.max(4, v.length));
  const keep = v.length >= 12 ? 2 : 1;
  return `${v.slice(0, keep)}${'•'.repeat(Math.min(12, v.length - keep * 2))}${v.slice(-keep)}`;
}

const SEVERITY_ORDER: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function highestLevel(levels: (RiskLevel | null)[]): RiskLevel | null {
  return SEVERITY_ORDER.find((l) => levels.includes(l)) ?? (levels.includes('SAFE') ? 'SAFE' : null);
}

/** Real scan of a user-added file: normaliser + L0 + L1 on every page. */
export function scanFile(fileName: string, text: string, sizeBytes: number, now = new Date()): ScannedDoc {
  let line = 1;
  const pages = splitPages(text).map((pageText, i): PageView => {
    const t0 = performance.now();
    // Titles carry position only, never content: a first line can itself be sensitive.
    const lines = pageText.split('\n').length - (pageText.endsWith('\n') ? 1 : 0);
    const title = lines > 1 ? `Lines ${line}–${line + lines - 1}` : `Line ${line}`;
    line += Math.max(1, lines);
    const matches = scanRules(normalise(pageText).text);
    const findings: PageFindingView[] = matches.map((m) => ({
      category: m.primaryCategory,
      entityType: m.entityType,
      evidence: redact(m.value),
      layer: m.rule === 'HONEYTOKEN' ? 'L0' : 'L1',
      rule: m.label,
    }));
    return {
      page: i + 1,
      title,
      level: highestLevel(matches.map((m) => m.severity)),
      findings,
      latencyMs: performance.now() - t0,
    };
  });
  return {
    id: `${fileName}-${now.getTime()}`,
    fileName,
    source: 'upload',
    sizeBytes,
    chars: text.length,
    pages,
    scannedAt: now.toISOString(),
    totalMs: pages.reduce((a, p) => a + p.latencyMs, 0),
  };
}

/** The simulated sample document in the same shape. */
export function sampleDoc(now = new Date()): ScannedDoc {
  return {
    id: 'sample',
    fileName: DOCUMENT.fileName,
    source: 'sample',
    sizeBytes: DOCUMENT.sizeKb * 1024,
    chars: 0,
    pages: DOC_PAGES.map((p) => ({ ...p, findings: p.findings.map((f) => ({ ...f })) })),
    scannedAt: now.toISOString(),
    totalMs: DOC_PAGES.reduce((a, p) => a + p.latencyMs, 0),
  };
}
