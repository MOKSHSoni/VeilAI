// Orchestrates one scan: applies state variants, derives mask targets from findings + minimisation,
// runs the real masking / verification / rehydration code, and lays out simulated step timings.

import type { Decision, Scenario } from '../data/types';
import { mask, minimiseTable, tableToCsv, type MaskTarget, type TableData, type VaultEntry } from './masking';
import { rehydrate, type RehydrateResult } from './rehydrate';
import { normalise, type NormaliseNote } from './rules';
import { maskAndVerify, type VerificationOutcome } from './verification';

export type StepId =
  | 'capture'
  | 'normalise'
  | 'task'
  | 'detect'
  | 'fusion'
  | 'policy'
  | 'explain'
  | 'minimise'
  | 'mask'
  | 'verify'
  | 'decision'
  | 'output';

export interface StepTiming {
  id: StepId;
  n: number;
  label: string;
  /** Simulated latency; null = not measured on-device (external AI time). */
  ms: number | null;
  skipped?: boolean;
}

export const STEP_LABELS: Record<StepId, string> = {
  capture: 'Capture',
  normalise: 'Normalise',
  task: 'Task Analysis',
  detect: 'Detection Ensemble',
  fusion: 'Fusion',
  policy: 'Policy + Risk',
  explain: 'Exposure Explanation',
  minimise: 'Data Minimisation',
  mask: 'Context-Preserving Masking',
  verify: 'Fast Local Verification',
  decision: 'Decision',
  output: 'External AI / Local Answer / Block',
};

export const QWEN_REVIEW_MS = 4200;

export interface ComputedStats {
  column: string;
  count: number;
  sum: number;
  average: number;
}

export interface PipelineRun {
  scenario: Scenario;
  allowlisted: boolean;
  normalised: { text: string; notes: NormaliseNote[] };
  targets: MaskTarget[];
  table: { original: TableData; kept: TableData; droppedValues: string[] } | null;
  verification: VerificationOutcome | null;
  sanitisedText: string | null;
  outboundPrompt: string | null;
  vault: VaultEntry[];
  aiReply: string | null;
  rehydrated: RehydrateResult | null;
  localAnswer: string | null;
  computed: ComputedStats | null;
  timings: StepTiming[];
  overrideEnabled: boolean;
  enabledDecisions: Decision[];
}

export interface PipelineContext {
  allowlist: readonly string[];
}

/** Indian digit grouping (12,34,567.5) without relying on locale data. */
export function formatINR(n: number): string {
  const [intPart, frac] = (Math.round(n * 100) / 100).toString().split('.');
  const neg = intPart.startsWith('-');
  const digits = neg ? intPart.slice(1) : intPart;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${neg ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

export function computeColumnStats(table: TableData, column: string): ComputedStats {
  const values = table.rows.map((r) => Number(r[column])).filter((v) => Number.isFinite(v));
  const sum = values.reduce((a, b) => a + b, 0);
  return { column, count: values.length, sum, average: values.length ? sum / values.length : 0 };
}

function fillTemplate(text: string, stats: ComputedStats | null): string {
  if (!stats) return text;
  return text
    .replace(/\{\{COUNT\}\}/g, String(stats.count))
    .replace(/\{\{SUM:[\w]+\}\}/g, formatINR(stats.sum))
    .replace(/\{\{AVG:[\w]+\}\}/g, formatINR(stats.average));
}

export function applyState(base: Scenario, ctx: PipelineContext): { scenario: Scenario; allowlisted: boolean } {
  const allow = new Set(ctx.allowlist.map((a) => a.toLowerCase()));
  const hit = base.findings.some((f) => allow.has(f.spanText.toLowerCase()) && f.severity !== 'CRITICAL');
  if (hit && base.stateVariants) return { scenario: { ...base, ...base.stateVariants.whenAllowlisted }, allowlisted: true };
  return { scenario: base, allowlisted: false };
}

/** Findings the task needs are KEPT; everything else becomes a mask target. */
export function maskTargetsFor(s: Scenario): MaskTarget[] {
  const kept = new Set(s.minimisation.filter((m) => m.action === 'KEPT' && m.findingId).map((m) => m.findingId));
  return s.findings
    .filter((f) => !kept.has(f.id))
    .map((f) => ({ original: f.spanText, entityType: f.entityType, category: f.primaryCategory }));
}

function timingsFor(s: Scenario, v: VerificationOutcome | null, blocked: boolean): StepTiming[] {
  const byLayer = Object.fromEntries(s.layerResults.map((l) => [l.layer, l]));
  const fast = Math.max(0, ...(['L0', 'L1', 'L2', 'L3', 'L4'] as const).map((l) => byLayer[l]?.latencyMs ?? 0));
  const l5 = byLayer.L5 && byLayer.L5.status !== 'SKIPPED' ? byLayer.L5.latencyMs : 0;
  const detect = Math.round((fast + l5 + 0.3) * 10) / 10; // fast layers run in parallel; L5 is gated after them
  const verifyMs = v ? v.attempts.length * 3.2 + (s.escalateToQwenReview ? QWEN_REVIEW_MS : 0) : 0;

  const raw: [StepId, number | null, boolean?][] = [
    ['capture', 0.4],
    ['normalise', s.normalisationNotes.length ? 3.2 : 1.2],
    ['task', 4],
    ['detect', detect],
    ['fusion', 0.8],
    ['policy', 0.6],
    ['explain', 1.5],
    ['minimise', blocked ? 0 : 2.5, blocked],
    ['mask', blocked ? 0 : 0.9, blocked],
    ['verify', blocked ? 0 : Math.round(verifyMs * 10) / 10, blocked],
  ];
  const used = raw.reduce((a, [, ms]) => a + (ms ?? 0), 0);
  const decision = Math.round((s.simulatedTotalMs - used) * 10) / 10;
  return [
    ...raw.map(([id, ms, skipped], i) => ({ id, n: i + 1, label: STEP_LABELS[id], ms, skipped })),
    { id: 'decision', n: 11, label: STEP_LABELS.decision, ms: decision },
    { id: 'output', n: 12, label: STEP_LABELS.output, ms: null },
  ];
}

export function runScenario(base: Scenario, ctx: PipelineContext = { allowlist: [] }): PipelineRun {
  const { scenario: s, allowlisted } = applyState(base, ctx);
  const normalised = normalise(s.content);
  const blocked = !!s.blocked;

  let table: PipelineRun['table'] = null;
  let computed: ComputedStats | null = null;
  let verification: VerificationOutcome | null = null;
  let sanitisedText: string | null = null;

  const targets = maskTargetsFor(s);

  if (!blocked) {
    if (s.structuredData) {
      const keepCols = s.minimisation.filter((m) => m.column && m.action === 'KEPT').map((m) => m.column!);
      const { table: kept, droppedValues } = minimiseTable(s.structuredData, keepCols);
      table = { original: s.structuredData, kept, droppedValues };
      computed = keepCols[0] ? computeColumnStats(kept, keepCols[0]) : null;
      verification = maskAndVerify(tableToCsv(kept), targets, { droppedValues });
    } else {
      verification = maskAndVerify(s.content, targets);
    }
    sanitisedText = verification.final.text;
  }

  const vault = verification?.final.vault ?? (blocked ? mask(s.content, targets).vault : []);
  const outboundPrompt = blocked ? null : sanitisedText ? `${s.instruction}\n\n${sanitisedText}` : s.instruction;
  const aiReply = !blocked && s.simulatedAIReply ? fillTemplate(s.simulatedAIReply, computed) : null;
  const rehydrated = aiReply ? rehydrate(aiReply, vault) : null;
  const localAnswer = s.localAnswer ? fillTemplate(s.localAnswer, computed) : null;

  const overrideEnabled = s.allowedDecisions.includes('OVERRIDE') && !blocked && s.riskLevel !== 'CRITICAL';
  const enabledDecisions = s.allowedDecisions.filter((d) => d !== 'OVERRIDE' || overrideEnabled);

  return {
    scenario: s,
    allowlisted,
    normalised,
    targets,
    table,
    verification,
    sanitisedText,
    outboundPrompt,
    vault: blocked ? [] : vault,
    aiReply,
    rehydrated,
    localAnswer,
    computed,
    timings: timingsFor(s, verification, blocked),
    overrideEnabled,
    enabledDecisions,
  };
}
