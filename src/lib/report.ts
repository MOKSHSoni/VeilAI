// Scan report export (HTML + JSON). Built entirely on this device; evidence is always redacted,
// so the report itself never contains a sensitive value. The HTML is self-contained (no external assets).

import { RISK_LEVELS, type RiskLevel } from '../data/types';
import { highestLevel, type ScannedDoc } from './documents';

export interface ScanReport {
  generator: string;
  generatedAt: string;
  file: { name: string; sizeBytes: number; pages: number };
  mode: string;
  simulated: boolean;
  overallLevel: RiskLevel | null;
  levelCounts: Record<string, number>;
  totalFindings: number;
  totalLatencyMs: number;
  pages: {
    page: number;
    title: string;
    level: RiskLevel | 'NO_RULE_MATCH';
    l5Ran?: boolean;
    findings: { category: string; entityType: string; layer: string; rule?: string; confidence?: number; evidenceRedacted: string }[];
  }[];
  notes: string[];
}

export const MODE_TEXT = {
  sample: 'Simulated demo document: findings, levels and latencies are hardcoded scenario data.',
  upload: 'Rules only (real): normaliser + L0 honeytokens + L1 deterministic rules (regex, Luhn, Verhoeff). L2–L5 were not run.',
};

export function buildReport(doc: ScannedDoc, now = new Date()): ScanReport {
  const levelCounts: Record<string, number> = {};
  for (const l of [...RISK_LEVELS, 'NO_RULE_MATCH']) levelCounts[l] = 0;
  for (const p of doc.pages) levelCounts[p.level ?? 'NO_RULE_MATCH']++;
  return {
    generator: 'VeilAI prototype',
    generatedAt: now.toISOString(),
    file: { name: doc.fileName, sizeBytes: doc.sizeBytes, pages: doc.pages.length },
    mode: MODE_TEXT[doc.source],
    simulated: doc.source === 'sample',
    overallLevel: highestLevel(doc.pages.map((p) => p.level)),
    levelCounts,
    totalFindings: doc.pages.reduce((a, p) => a + p.findings.length, 0),
    totalLatencyMs: Math.round(doc.totalMs * 100) / 100,
    pages: doc.pages.map((p) => ({
      page: p.page,
      title: p.title,
      level: p.level ?? 'NO_RULE_MATCH',
      ...(p.l5Ran !== undefined ? { l5Ran: p.l5Ran } : {}),
      findings: p.findings.map((f) => ({
        category: f.category,
        entityType: f.entityType,
        layer: f.layer,
        ...(f.rule ? { rule: f.rule } : {}),
        ...(f.confidence !== undefined ? { confidence: f.confidence } : {}),
        evidenceRedacted: f.evidence,
      })),
    })),
    notes: [
      'Evidence is redacted: this report never contains a full sensitive value.',
      'Generated locally in the browser. No content was sent to any server.',
      ...(doc.source === 'upload' ? ['"NO_RULE_MATCH" means no known pattern was found. It is not a SAFE verdict: contextual layers (L2–L5) did not run.'] : []),
    ],
  };
}

export function reportJson(doc: ScannedDoc, now = new Date()): string {
  return JSON.stringify(buildReport(doc, now), null, 2);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const COLORS: Record<string, string> = {
  SAFE: '#16874a', LOW: '#0b857a', MEDIUM: '#b27700', HIGH: '#d9480f', CRITICAL: '#d42a1f', REVIEW: '#6d4ce6', NO_RULE_MATCH: '#85868f',
};

const badge = (l: string) => `<span class="b" style="color:${COLORS[l]};border-color:${COLORS[l]}">${esc(l.replace(/_/g, ' '))}</span>`;

export function reportHtml(doc: ScannedDoc, now = new Date()): string {
  const r = buildReport(doc, now);
  const counts = Object.entries(r.levelCounts)
    .filter(([, n]) => n > 0)
    .map(([l, n]) => `<td>${badge(l)}</td><td class="n">${n}</td>`)
    .join('');
  const rows = r.pages
    .map((p) => {
      const f = p.findings.length
        ? `<ul>${p.findings
            .map((x) => `<li><code>${esc(x.category)}</code> ${esc(x.rule ?? x.entityType)} · ${esc(x.layer)}${x.confidence !== undefined ? ` · ${Math.round(x.confidence * 100)}%` : ''}<br><span class="ev">${esc(x.evidenceRedacted)}</span></li>`)
            .join('')}</ul>`
        : '<span class="m">none</span>';
      return `<tr><td class="n">${p.page}</td><td>${esc(p.title)}${p.l5Ran ? ' <span class="m">(L5 ran)</span>' : ''}</td><td>${badge(p.level)}</td><td>${f}</td></tr>`;
    })
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>VeilAI scan report: ${esc(r.file.name)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#15161b;background:#fbfaf7;max-width:960px;margin:32px auto;padding:0 20px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}
.k{font:11px ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:#85868f}
.box{border:1px solid #e1dfd6;border-radius:10px;padding:12px 16px;background:#fff;margin:12px 0}
.warn{border-color:#b27700;background:#fff8e8}
table{border-collapse:collapse;width:100%}td,th{border-top:1px solid #e1dfd6;padding:7px 8px;text-align:left;vertical-align:top}
th{font:11px ui-monospace,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#85868f;border-top:0}
.b{font:600 11px ui-monospace,Consolas,monospace;border:1px solid;border-radius:5px;padding:1px 6px;white-space:nowrap}
.n{font-family:ui-monospace,Consolas,monospace;text-align:right;width:1%}.m{color:#85868f}
code,.ev{font:12px ui-monospace,Consolas,monospace}.ev{color:#4a4c56}ul{margin:0;padding-left:16px}
.counts{width:auto}.counts td{border:0;padding:2px 6px 2px 0}.counts td.n{padding-right:18px}
@media print{body{margin:0;background:#fff}.box{break-inside:avoid}tr{break-inside:avoid}}
</style></head><body>
<div class="k">VeilAI · local scan report</div>
<h1>${esc(r.file.name)}</h1>
<div class="m">${r.file.pages} page${r.file.pages === 1 ? '' : 's'} · ${(r.file.sizeBytes / 1024).toFixed(1)} KB · generated ${esc(now.toLocaleString())}</div>
<div class="box${r.simulated ? ' warn' : ''}"><b>${r.simulated ? 'Simulated' : 'Scan mode'}:</b> ${esc(r.mode)}</div>
<div class="box"><div class="k">Overall</div>
<p>Highest level: ${badge(r.overallLevel ?? 'NO_RULE_MATCH')} · ${r.totalFindings} finding${r.totalFindings === 1 ? '' : 's'} · ${r.totalLatencyMs} ms ${r.simulated ? '(simulated)' : '(measured on this device)'}</p>
<table class="counts"><tr>${counts}</tr></table></div>
<h2>Pages</h2>
<table><thead><tr><th>#</th><th>Page</th><th>Level</th><th>Findings (evidence redacted)</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Notes</h2><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
</body></html>`;
}

export function reportFileName(doc: ScannedDoc, ext: 'html' | 'json', now = new Date()): string {
  const base = doc.fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'document';
  return `veilai-report_${base}_${now.toISOString().slice(0, 10)}.${ext}`;
}

/** Triggers a local download (Blob + object URL). Nothing leaves the device. */
export function downloadFile(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
