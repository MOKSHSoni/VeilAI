import { describe, expect, it } from 'vitest';
import { checkFile, looksBinary, redact, sampleDoc, scanFile, splitPages } from '../src/lib/documents';
import { buildReport, reportHtml, reportJson } from '../src/lib/report';

const SECRET = 'AKIAQ7X3VEILDEMO4K2P';
const FILE = `Quarterly notes\nNothing sensitive here.\n${'filler line of text\n'.repeat(200)}Deploy key: ${SECRET}\nContact priya.nair@example.com\n`;

describe('splitPages', () => {
  it('keeps short text as one page', () => {
    expect(splitPages('hello')).toEqual(['hello']);
  });
  it('splits long text on line boundaries near the page size', () => {
    const pages = splitPages(FILE, 1000);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.join('')).toBe(FILE);
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(1000);
  });
  it('honours form feeds and hard-wraps a single huge line', () => {
    expect(splitPages('a\fb\f c')).toEqual(['a', 'b', ' c']);
    expect(splitPages('x'.repeat(2500), 1000)).toEqual(['x'.repeat(1000), 'x'.repeat(1000), 'x'.repeat(500)]);
  });
});

describe('checkFile / looksBinary', () => {
  it('accepts text formats and rejects binary document formats with a reason', () => {
    expect(checkFile('notes.txt', 100)).toEqual({ ok: true });
    expect(checkFile('config.yaml', 100)).toEqual({ ok: true });
    expect(checkFile('.env', 100)).toEqual({ ok: true });
    const pdf = checkFile('board.pdf', 100);
    expect(pdf.ok).toBe(false);
    expect(checkFile('big.txt', 5 * 1024 * 1024).ok).toBe(false);
    expect(checkFile('empty.txt', 0).ok).toBe(false);
  });
  it('detects binary content', () => {
    expect(looksBinary('plain text')).toBe(false);
    expect(looksBinary('PK\u0003\u0004\u0000\u0000binary')).toBe(true);
  });
});

describe('redact', () => {
  it('never returns the full value', () => {
    const r = redact(SECRET);
    expect(r).not.toContain(SECRET);
    expect(r.startsWith('AK')).toBe(true);
    expect(r.endsWith('2P')).toBe(true);
    expect(redact('abc')).toBe('••••');
  });
});

describe('scanFile (real rules)', () => {
  const doc = scanFile('notes.txt', FILE, FILE.length);

  it('finds the secret and the email on the right pages, with levels from rule severity', () => {
    const hits = doc.pages.filter((p) => p.findings.length);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const all = doc.pages.flatMap((p) => p.findings);
    expect(all.map((f) => f.entityType)).toEqual(expect.arrayContaining(['SECRET', 'EMAIL']));
    expect(doc.pages.some((p) => p.level === 'CRITICAL')).toBe(true);
    expect(doc.pages[0].level).toBeNull(); // no rule match is not SAFE
    expect(doc.pages[0].title).toMatch(/^Lines 1–\d+$/); // position only, never content
  });

  it('stores only redacted evidence', () => {
    expect(JSON.stringify(doc)).not.toContain(SECRET);
    expect(JSON.stringify(doc)).not.toContain('priya.nair@example.com');
  });
});

describe('reports', () => {
  const doc = scanFile('notes.txt', FILE, FILE.length);

  it('JSON report summarises levels and never contains raw values', () => {
    const r = buildReport(doc);
    expect(r.simulated).toBe(false);
    expect(r.overallLevel).toBe('CRITICAL');
    expect(r.totalFindings).toBe(2);
    expect(r.levelCounts.NO_RULE_MATCH).toBeGreaterThan(0);
    expect(reportJson(doc)).not.toContain(SECRET);
  });

  it('HTML report is self-contained, escaped and redacted', () => {
    const html = reportHtml(scanFile('<script>.txt', FILE, FILE.length));
    expect(html).not.toContain(SECRET);
    expect(html).not.toContain('<script>.txt');
    expect(html).toContain('&lt;script&gt;.txt');
    expect(html).not.toMatch(/(src|href)=["']https?:/);
  });

  it('sample report is marked as simulated', () => {
    const r = buildReport(sampleDoc());
    expect(r.simulated).toBe(true);
    expect(r.file.pages).toBe(10);
    expect(r.overallLevel).toBe('CRITICAL');
  });
});
