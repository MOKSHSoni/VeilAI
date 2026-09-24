// Runs VeilAI's deterministic layers over the benchmark dataset and writes per-document hits.
//   npx vite-node scripts/ablation-layers.ts -- <path/to/dataset.json> <out.json>
//
// L0 + L1: the real rules.ts (normaliser, regex, Luhn, Verhoeff, honeytoken hashes).
// L4:      cue rules taken ONLY from the design doc §11.2 list, written before inspecting the
//          dataset and not tuned on it (the benchmark set is the held-out test set).

import { readFileSync, writeFileSync } from 'node:fs';
import { normalise, scanRules } from '../src/lib/rules';

type Cat = 'PERSONAL_INFORMATION' | 'CUSTOMER_INFORMATION' | 'FINANCIAL' | 'CONFIDENTIAL_BUSINESS' | 'INTELLECTUAL_PROPERTY' | 'SECURITY' | 'CREDENTIALS';

const MONEY = String.raw`(?:₹|rs\.?|inr|\$|€|£|usd)\s?\d[\d,.]*|\d[\d,.]*\s?(?:crore|cr|lakh|lpa|million|billion|mn|bn|k)\b|\d[\d,.]*\s?%`;
const FIN_WORDS = String.raw`revenue|margin|salary|salaries|compensation|forecast|valuation|profit|ebitda|earnings|budget|bonus|payroll`;

const CUES: { id: string; cat: Cat; re: RegExp }[] = [
  // "currency/number near revenue/margin/salary/forecast/valuation"
  { id: 'money-near-finance', cat: 'FINANCIAL', re: new RegExp(`(?:${MONEY})[^.\\n]{0,60}\\b(?:${FIN_WORDS})\\b|\\b(?:${FIN_WORDS})\\b[^.\\n]{0,60}(?:${MONEY})`, 'i') },
  // "unreleased", "board approved", "proprietary", "do not distribute"
  { id: 'board-approved', cat: 'CONFIDENTIAL_BUSINESS', re: /\bboard\s+(?:has\s+)?approved\b/i },
  { id: 'do-not-distribute', cat: 'CONFIDENTIAL_BUSINESS', re: /\bdo\s+not\s+(?:distribute|share|forward)\b|\bnot\s+for\s+distribution\b/i },
  { id: 'confidential-marking', cat: 'CONFIDENTIAL_BUSINESS', re: /\b(?:strictly\s+)?confidential\b|\binternal\s+only\b/i },
  { id: 'unreleased', cat: 'INTELLECTUAL_PROPERTY', re: /\bunreleased\b|\bunannounced\b/i },
  { id: 'proprietary', cat: 'INTELLECTUAL_PROPERTY', re: /\bproprietary\b|\btrade\s+secret\b|\bpatent[-\s]pending\b/i },
  // "code and config detection"
  { id: 'secret-material', cat: 'SECURITY', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/\S+/i },
];

const [datasetPath, outPath] = process.argv.slice(2).filter((a) => a !== '--');
const data = JSON.parse(readFileSync(datasetPath, 'utf8')) as { documents: { document_id: string; text: string }[] };

const out: Record<string, { l0: string[]; l1: { rule: string; cats: string[] }[]; l4: { cue: string; cat: Cat }[]; ms: number }> = {};
for (const d of data.documents) {
  const t0 = performance.now();
  const n = normalise(d.text);
  const matches = scanRules(n.text);
  const cues = CUES.filter((c) => c.re.test(n.text)).map((c) => ({ cue: c.id, cat: c.cat }));
  out[d.document_id] = {
    l0: matches.filter((m) => m.rule === 'HONEYTOKEN').map((m) => m.honeytokenId!),
    l1: matches.filter((m) => m.rule !== 'HONEYTOKEN').map((m) => ({ rule: m.rule, cats: m.labels })),
    l4: cues,
    ms: performance.now() - t0,
  };
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
const n = Object.values(out);
console.log(`${n.length} docs · L1 hits in ${n.filter((x) => x.l1.length).length} · L4 hits in ${n.filter((x) => x.l4.length).length} · mean ${(n.reduce((a, x) => a + x.ms, 0) / n.length).toFixed(2)} ms/doc`);
