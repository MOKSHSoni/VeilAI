// REAL measured benchmark data (build spec §9.5). The only real numbers in the app.
// Edit here when new results arrive. `null` renders as "To be measured". Never invent ensemble values.

import type { Category } from './types';

export const BENCHMARK_SETUP = {
  documents: 192,
  sensitive: 147,
  safe: 45,
  hardware: 'Intel Core Ultra 5 125H · 16 GB RAM · CPU only',
};

export const MODELS = ['Qwen3 1.7B', 'Qwen3 4B'] as const;

export interface OverallMetric {
  metric: string;
  q17b: string;
  q4b: string;
  /** true when a lower value is better */
  lowerIsBetter?: boolean;
}

export const OVERALL: OverallMetric[] = [
  { metric: 'Recall', q17b: '37.4%', q4b: '45.6%' },
  { metric: 'Precision', q17b: '93.2%', q4b: '95.7%' },
  { metric: 'False Negative Rate', q17b: '62.6%', q4b: '54.4%', lowerIsBetter: true },
  { metric: 'False Positive Rate', q17b: '8.9%', q4b: '6.7%', lowerIsBetter: true },
  { metric: 'Hard-case Recall', q17b: '18.9%', q4b: '24.3%' },
  { metric: 'Average Short-Document Time', q17b: '6.4 s', q4b: '8.0 s', lowerIsBetter: true },
];

export interface CategoryRow {
  category: Category;
  docs: number;
  q17b: number; // recall %
  q4b: number;
}

export const BY_CATEGORY: CategoryRow[] = [
  { category: 'CREDENTIALS', docs: 21, q17b: 90.5, q4b: 95.2 },
  { category: 'CUSTOMER_INFORMATION', docs: 26, q17b: 69.2, q4b: 69.2 },
  { category: 'PERSONAL_INFORMATION', docs: 29, q17b: 58.6, q4b: 58.6 },
  { category: 'SECURITY', docs: 35, q17b: 62.9, q4b: 20.0 },
  { category: 'INTELLECTUAL_PROPERTY', docs: 27, q17b: 11.1, q4b: 25.9 },
  { category: 'CONFIDENTIAL_BUSINESS', docs: 33, q17b: 24.2, q4b: 24.2 },
  { category: 'FINANCIAL', docs: 32, q17b: 18.8, q4b: 12.5 },
];

export const SECURITY_FOOTNOTE =
  "The SECURITY result is a labelling effect: the 4B model often labels API keys and passwords as CREDENTIALS without also adding SECURITY. VeilAI's multi-label findings prevent this from being misread as a detection failure.";

export interface LongDocRow {
  pages: string;
  result: string;
  detected: boolean;
}

export const LONG_DOCUMENT: LongDocRow[] = [
  { pages: '1 page', result: 'Both models detected it', detected: true },
  { pages: '5 pages', result: 'Neither reliably detected it', detected: false },
  { pages: '10 pages', result: 'Neither reliably detected it', detected: false },
  { pages: '15 pages', result: 'Neither reliably detected it', detected: false },
];

export const LONG_DOCUMENT_CONCLUSION = 'This is why VeilAI uses chunking, the gating router and multiple detection layers.';

export interface AblationRow {
  step: number;
  change: string;
  recall: string | null;
  fnr: string | null;
  fpr: string | null;
}

// Measured on the same 192 documents with the same scoring code as the LLM-only baseline
// (model testing/privacy-benchmark/ablation/, ablation_results.json). Cumulative, flag on any.
export const ABLATION: AblationRow[] = [
  { step: 0, change: 'Qwen3 4B baseline (LLM only)', recall: '45.6%', fnr: '54.4%', fpr: '6.7%' },
  { step: 1, change: '+ Label hierarchy / multi-label scoring', recall: '45.6%', fnr: '54.4%', fpr: '6.7%' },
  { step: 2, change: '+ L1 deterministic rules + L2 entity NER (Presidio + GLiNER)', recall: '57.8%', fnr: '42.2%', fpr: '17.8%' },
  { step: 3, change: '+ Chunked, per-category L5 prompts (financial, business, IP)', recall: '95.2%', fnr: '4.8%', fpr: '22.2%' },
  { step: 4, change: '+ L4 context signals (cue rules only; classifier not yet trained)', recall: '95.2%', fnr: '4.8%', fpr: '24.4%' },
  { step: 5, change: '+ L3 Org DNA + L0 honeytokens (needs an org corpus + planted test set)', recall: null, fnr: null, fpr: null },
  { step: 6, change: 'Full fusion (flag on any, clear on all)', recall: null, fnr: null, fpr: null },
];

/** Headline for the ablation panel: the last measured step vs the baseline. */
export const ABLATION_HEADLINE = (() => {
  const last = [...ABLATION].reverse().find((r) => r.recall);
  return last && last.step > 0 ? `LLM alone: ${ABLATION[0].recall} recall. VeilAI layers (steps 1–${last.step}): ${last.recall}.` : `LLM alone: ${ABLATION[0].recall} recall. VeilAI ensemble: to be measured.`;
})();

export const ABLATION_NOTE =
  'Recall and FNR score sensitive-vs-safe detection; per-category labels from step 3 are not yet reliable (category precision 38–52%). ' +
  'False positives rise as layers are added: a flag means minimise and mask, not block. Minimisation, masking and verification are measured separately ' +
  '(utility retention %, residual leaks after masking), not by detection recall.';
