import { describe, expect, it } from 'vitest';
import { SCENARIOS, getScenario } from '../src/data/scenarios';
import { CATEGORIES, DECISIONS, LAYER_IDS, RISK_LEVELS, type Scenario } from '../src/data/types';
import { formatINR, runScenario } from '../src/lib/pipeline';
import { verify } from '../src/lib/verification';
import { findOccurrences } from '../src/lib/masking';
import { normalise } from '../src/lib/rules';

const PLACEHOLDER = /⟦[^⟦⟧]*⟧/g;

// Every scenario in both its base state and (where defined) its allowlisted state.
const variants: { name: string; s: Scenario; allowlist: string[] }[] = SCENARIOS.flatMap((s) => [
  { name: `#${s.id} ${s.title}`, s, allowlist: [] },
  ...(s.stateVariants ? [{ name: `#${s.id} ${s.title} (allowlisted)`, s, allowlist: s.findings.map((f) => f.spanText) }] : []),
]);

describe('scenario data contract', () => {
  it('has 10 scenarios with ids 1–10', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('scenario %i satisfies the type contract', (_id, s) => {
    expect(s.title).toBeTruthy();
    expect(s.instruction).toBeTruthy();
    expect(typeof s.content).toBe('string');
    expect(RISK_LEVELS).toContain(s.riskLevel);
    expect(s.riskScore).toBeGreaterThanOrEqual(0);
    expect(s.riskScore).toBeLessThanOrEqual(100);
    expect(s.fusion.fusedConfidence).toBeGreaterThanOrEqual(0);
    expect(s.fusion.fusedConfidence).toBeLessThanOrEqual(1);
    expect(s.layerResults.map((l) => l.layer)).toEqual(LAYER_IDS);
    expect(DECISIONS).toContain(s.defaultDecision);
    expect(s.allowedDecisions).toContain(s.defaultDecision);
    for (const d of s.allowedDecisions) expect(DECISIONS).toContain(d);
    const ids = new Set(s.findings.map((f) => f.id));
    expect(ids.size).toBe(s.findings.length);
    for (const f of s.findings) {
      expect(CATEGORIES).toContain(f.primaryCategory);
      expect(f.labels).toContain(f.primaryCategory);
      for (const l of f.labels) expect(CATEGORIES).toContain(l);
      expect(f.confidence).toBeGreaterThanOrEqual(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
      expect(RISK_LEVELS).toContain(f.severity);
    }
    for (const l of s.layerResults) for (const id of l.findingIds) expect(ids).toContain(id);
    for (const m of s.minimisation) if (m.findingId) expect(ids).toContain(m.findingId);
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))("scenario %i: every finding's spanText occurs in its content", (_id, s) => {
    for (const f of s.findings) expect(s.content).toContain(f.spanText);
  });

  it('SAFE is used only when every layer is clear or skipped (clear on all)', () => {
    for (const { s, allowlist } of variants) {
      const run = runScenario(s, { allowlist });
      const flagged = run.scenario.layerResults.some((l) => l.status === 'FLAGGED');
      if (run.scenario.riskLevel === 'SAFE') expect(flagged).toBe(false);
      else expect(flagged).toBe(true);
    }
  });

  it('normalisation notes are reproduced by the real normaliser', () => {
    for (const s of SCENARIOS) {
      const { notes } = normalise(s.content);
      for (const n of s.normalisationNotes) expect(notes).toContainEqual(n);
    }
  });
});

describe.each(variants)('pipeline: $name', ({ s, allowlist }) => {
  const run = runScenario(s, { allowlist });

  it('every placeholder in the final sanitised text exists in the vault', () => {
    if (run.sanitisedText === null) return;
    const vaultPh = new Set(run.vault.map((v) => v.placeholder));
    for (const ph of run.sanitisedText.match(PLACEHOLDER) ?? []) expect(vaultPh).toContain(ph);
  });

  it('no vault value or variant appears in the final sanitised text', () => {
    if (run.sanitisedText === null) return;
    const r = verify(run.sanitisedText, run.vault, { droppedValues: run.table?.droppedValues });
    expect(r.leaks).toEqual([]);
    expect(r.passed).toBe(true);
    for (const v of run.vault) expect(findOccurrences(run.sanitisedText, v.original, true)).toEqual([]);
  });

  it('verification ends in PASS or REPAIRED', () => {
    if (run.scenario.blocked) return;
    expect(['PASS', 'REPAIRED']).toContain(run.verification!.status);
  });

  it('never enables OVERRIDE when allowedDecisions excludes it, or for CRITICAL', () => {
    if (!run.scenario.allowedDecisions.includes('OVERRIDE')) expect(run.overrideEnabled).toBe(false);
    if (run.scenario.riskLevel === 'CRITICAL') expect(run.overrideEnabled).toBe(false);
    for (const d of run.enabledDecisions) expect(run.scenario.allowedDecisions).toContain(d);
  });

  it('simulated step latencies fit inside simulatedTotalMs', () => {
    const decision = run.timings.find((t) => t.id === 'decision')!;
    expect(decision.ms!).toBeGreaterThanOrEqual(0);
    const sum = run.timings.reduce((a, t) => a + (t.ms ?? 0), 0);
    expect(Math.round(sum)).toBe(Math.round(run.scenario.simulatedTotalMs));
  });

  it('rehydrated reply never contains a secret', () => {
    if (!run.rehydrated) return;
    for (const v of run.vault.filter((x) => x.secret)) expect(run.rehydrated.text).not.toContain(v.original);
    expect(run.rehydrated.unresolved).toEqual([]);
  });
});

describe('specific scenarios', () => {
  it('blocked scenarios produce no sanitised text and cannot be overridden', () => {
    const blocked = SCENARIOS.filter((s) => s.blocked);
    expect(blocked.map((s) => s.id)).toEqual([2]);
    for (const s of blocked) {
      const run = runScenario(s);
      expect(run.sanitisedText).toBeNull();
      expect(run.outboundPrompt).toBeNull();
      expect(run.aiReply).toBeNull();
      expect(run.overrideEnabled).toBe(false);
      expect(run.enabledDecisions).toEqual(['BLOCK']);
    }
  });

  it('Scenario 1 masks secrets and host, keeps code logic', () => {
    const run = runScenario(getScenario(1));
    expect(run.sanitisedText).toContain('AWS_ACCESS_KEY_ID = "⟦SECRET_1⟧"');
    expect(run.sanitisedText).toContain('DB_PASSWORD = "⟦SECRET_2⟧"');
    expect(run.sanitisedText).toContain('host="⟦INTERNAL_HOST_1⟧"');
    expect(run.sanitisedText).toContain('connect_timeout=3');
    expect(run.scenario.riskLevel).toBe('CRITICAL');
    expect(run.scenario.findings[0].labels).toEqual(['CREDENTIALS', 'SECURITY']);
    expect(run.scenario.defaultDecision).toBe('SEND_SANITISED');
  });

  it('Scenario 3 pseudonymises client and valuation', () => {
    const run = runScenario(getScenario(3));
    expect(run.sanitisedText).toBe('The board has approved negotiations with ⟦CLIENT_A⟧, expected to close in Q4 at a valuation near ⟦DEAL_VALUE_1⟧.');
    expect(run.scenario.defaultDecision).toBe('ANSWER_LOCALLY');
  });

  it("Scenario 4's displayed average equals the average computed from the data", () => {
    const s = getScenario(4);
    const spends = s.structuredData!.rows.map((r) => Number(r.total_spend));
    const expected = spends.reduce((a, b) => a + b, 0) / spends.length;
    const run = runScenario(s);
    expect(run.computed!.average).toBe(expected);
    expect(run.aiReply).toContain(`₹${formatINR(expected)}`);
    expect(run.sanitisedText!.split('\n')[0]).toBe('total_spend');
    expect(run.table!.kept.columns).toEqual(['total_spend']);
    for (const r of s.structuredData!.rows) {
      expect(run.sanitisedText).not.toContain(String(r.email));
      expect(run.sanitisedText).not.toContain(String(r.name));
    }
  });

  it('Scenario 6 is SAFE, sent unchanged, and shows under 100 ms', () => {
    const run = runScenario(getScenario(6));
    expect(run.scenario.riskLevel).toBe('SAFE');
    expect(run.outboundPrompt).toBe(getScenario(6).instruction);
    expect(run.scenario.simulatedTotalMs).toBeLessThan(100);
  });

  it('Scenario 7 escalates from three LOW messages to HIGH', () => {
    const s = getScenario(7);
    expect(s.messages!.map((m) => m.riskLevel)).toEqual(['LOW', 'LOW', 'LOW']);
    expect(s.riskLevel).toBe('HIGH');
    expect(s.mosaicWarning).toBe("Across this session you've shared the client, deal size and closing date.");
  });

  it('Scenario 8 normalises both evasions and masks the raw spans', () => {
    const run = runScenario(getScenario(8));
    expect(run.normalised.notes).toHaveLength(2);
    expect(run.sanitisedText).toContain('PAYMENTS_KEY = ⟦SECRET_1⟧');
    expect(run.sanitisedText).toContain('db_pass_b64: ⟦SECRET_2⟧');
  });

  it('Scenario 9 is REVIEW with escalated Qwen review and no block', () => {
    const run = runScenario(getScenario(9));
    expect(run.scenario.riskLevel).toBe('REVIEW');
    expect(run.scenario.escalateToQwenReview).toBe(true);
    expect(run.enabledDecisions).toEqual(['SEND_SANITISED', 'EDIT', 'OVERRIDE']);
  });

  it('Scenario 10 is MEDIUM, and SAFE once Project Atlas is allowlisted', () => {
    const s = getScenario(10);
    expect(runScenario(s).scenario.riskLevel).toBe('MEDIUM');
    const after = runScenario(s, { allowlist: ['Project Atlas'] });
    expect(after.allowlisted).toBe(true);
    expect(after.scenario.riskLevel).toBe('SAFE');
    expect(after.sanitisedText).toBe(s.content);
  });
});
