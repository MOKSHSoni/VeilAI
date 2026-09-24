import type { ReactNode } from 'react';
import { CATEGORIES, type Category, type Decision } from '../../data/types';
import { NECESSITY_COLUMNS, NECESSITY_MATRIX, POLICY_YAML, TASK_TO_ROW, destinationOf } from '../../data/policy';
import type { PipelineRun } from '../../lib/pipeline';
import { QWEN_REVIEW_MS } from '../../lib/pipeline';
import { verify } from '../../lib/verification';
import { tableToCsv } from '../../lib/masking';
import { HONEYTOKEN_REGISTRY, scanRules } from '../../lib/rules';
import { DetectionFork } from '../DetectionFork';
import { LayerCard } from '../LayerCard';
import { ExplainerCard } from '../ExplainerCard';
import { MinimisationView } from '../MinimisationView';
import { DiffView } from '../DiffView';
import { VaultPanel } from '../VaultPanel';
import { VerificationChecks } from '../VerificationChecks';
import { RehydrationView } from '../RehydrationView';
import { RiskBadge } from '../RiskBadge';
import { Icon } from '../Icon';
import { CategoryChip, Kicker, Meter, pct, riskVar, SimTag, tint, Btn } from '../ui';

export function Callout({ icon = 'shield', color = 'var(--accent)', children }: { icon?: Parameters<typeof Icon>[0]['name']; color?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: tint(color, 35), background: tint(color, 7) }}>
      <Icon name={icon} size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-ink-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 1 Capture

export function CaptureStage({ run }: { run: PipelineRun }) {
  const s = run.scenario;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Instruction" hint="what the user asks the AI to do">
          <div className="text-[13.5px] font-medium">{s.instruction}</div>
        </Field>
        <Field label="Destination">
          <div className="whitespace-nowrap font-mono text-[12px]">{s.destinationTool}</div>
        </Field>
      </div>
      <Field label="Content" hint="pasted text, analysed separately from the instruction">
        {s.messages ? (
          <ol className="space-y-1 text-[12.5px]">
            {s.messages.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-[10.5px] text-ink-3">MSG {i + 1}</span>
                {m.content}
              </li>
            ))}
          </ol>
        ) : s.content ? (
          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-2">{s.content}</pre>
        ) : (
          <div className="text-[12.5px] italic text-ink-3">No pasted content: the instruction is the whole prompt.</div>
        )}
      </Field>
      <Callout icon="eye">Captured at the point of exit (paste, type and submit hooks) before anything reaches {s.destinationTool.split(' ·')[0]}.</Callout>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2">
      <div className="mb-1 flex items-baseline gap-2">
        <Kicker>{label}</Kicker>
        {hint && <span className="text-[10.5px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- 2 Normalise

export function NormaliseStage({ run }: { run: PipelineRun }) {
  const notes = run.normalised.notes;
  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <Callout icon="check" color="var(--safe)">
          No evasion found. Checked for zero-width characters, Unicode homoglyphs, spaced-out characters and base64 or hex encodings.
        </Callout>
      ) : (
        <>
          <Callout icon="alert" color="var(--high)">
            <b className="text-ink">Evasion attempt decoded.</b> Detection runs on the normalised text, so obfuscated secrets are caught by the same rules.
          </Callout>
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={i} className="rise overflow-hidden rounded-lg border border-line bg-panel" style={{ animationDelay: `${i * 250}ms` }}>
                <div className="border-b border-line px-3 py-1.5">
                  <Kicker>{n.method}</Kicker>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2">
                  <code className="break-all font-mono text-[11.5px] text-ink-3">{n.before}</code>
                  <Icon name="arrow" size={14} className="text-ink-3" />
                  <code className="break-all font-mono text-[11.5px] font-semibold" style={{ color: 'var(--critical)' }}>
                    {n.after}
                  </code>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 3 Task analysis

export function TaskStage({ run }: { run: PipelineRun }) {
  const s = run.scenario;
  const row = TASK_TO_ROW[s.taskType];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3">
        <div>
          <Kicker>Detected task</Kicker>
          <div className="font-display text-[22px] font-semibold tracking-tight">{s.taskType}</div>
        </div>
        <SimTag />
      </div>
      <p className="text-[12.5px] text-ink-2">The task decides what data is actually needed. The Data Minimisation Engine reads this row of the necessity matrix later on.</p>
      {row ? (
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-panel-2">
                <th className="px-2.5 py-1.5 text-left font-normal">
                  <Kicker>Task</Kicker>
                </th>
                {NECESSITY_COLUMNS.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-left font-normal">
                    <Kicker>{c}</Kicker>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(NECESSITY_MATRIX).map(([task, cells]) => (
                <tr key={task} className={`border-t border-line/70 ${task === row ? 'bg-accent-soft font-medium text-ink' : 'text-ink-3'}`}>
                  <td className="whitespace-nowrap px-2.5 py-1.5">{task}</td>
                  {cells.map((c, i) => (
                    <td key={i} className={`px-2 py-1.5 ${c === 'Always drop' ? 'font-semibold text-critical' : ''}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Callout icon="check" color="var(--safe)">
          A general knowledge question needs no organisational data at all.
        </Callout>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 4 Detection

export function DetectStage({ run, animate }: { run: PipelineRun; animate: boolean }) {
  return (
    <div className="space-y-3">
      <DetectionFork layers={run.scenario.layerResults} />
      <div className="grid grid-cols-3 gap-2">
        {run.scenario.layerResults.map((l, i) => (
          <LayerCard key={l.layer} result={l} delay={animate ? i * 180 : 0} />
        ))}
      </div>
      <p className="border-l-2 border-accent pl-3 text-[12.5px] italic text-ink-2">Qwen provides semantic understanding; deterministic rules provide fast, precise pattern detection.</p>
    </div>
  );
}

// ---------------------------------------------------------------- 5 Fusion

export function FusionStage({ run }: { run: PipelineRun }) {
  const s = run.scenario;
  const labels = CATEGORIES.filter((c) => s.findings.some((f) => f.labels.includes(c)));
  const primaries = new Set<Category>(s.findings.map((f) => f.primaryCategory));
  const anyFlag = s.layerResults.some((l) => l.status === 'FLAGGED');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1.1fr_1fr] gap-3">
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="flex items-center justify-between">
            <Kicker>Fused confidence (noisy-OR)</Kicker>
            <SimTag />
          </div>
          <div className="num mt-1 font-mono text-[28px] font-semibold leading-none">{pct(s.fusion.fusedConfidence)}</div>
          <Meter className="mt-2" value={s.fusion.fusedConfidence} />
          <div className="mt-1.5 font-mono text-[10px] text-ink-3">fused = 1 − Π(1 − wᵢ·cᵢ)</div>
        </div>
        <div className="rounded-lg border border-line bg-panel p-3">
          <Kicker>Consensus</Kicker>
          <div className="mt-2 flex gap-1">
            {s.layerResults.map((l) => (
              <div
                key={l.layer}
                className={`flex h-7 flex-1 items-center justify-center rounded font-mono text-[10px] font-semibold ${l.status === 'SKIPPED' ? 'border border-dashed border-line-2 text-ink-3' : ''}`}
                style={l.status === 'SKIPPED' ? {} : { background: tint(l.status === 'FLAGGED' ? 'var(--critical)' : 'var(--safe)', 16), color: l.status === 'FLAGGED' ? 'var(--critical)' : 'var(--safe)' }}
              >
                {l.layer}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[12px] font-medium">{anyFlag ? 'Flag on any → risk raised' : 'Clear on all → SAFE allowed'}</div>
          <div className="text-[11px] text-ink-3">A critical finding is never averaged away.</div>
        </div>
      </div>
      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Kicker className="mr-1">Final categories</Kicker>
          {labels.map((c) => (
            <CategoryChip key={c} c={c} primary={primaries.has(c)} />
          ))}
        </div>
      )}
      {s.fusion.labelHierarchyNote && <Callout icon="layers">{s.fusion.labelHierarchyNote}</Callout>}
      {s.findings.length > 0 && <FindingsTable run={run} />}
    </div>
  );
}

function FindingsTable({ run }: { run: PipelineRun }) {
  const f = run.scenario.findings;
  const shown = f.slice(0, 6);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <table className="w-full table-fixed text-[11.5px]">
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[27%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead className="bg-panel-2 text-left">
          <tr>
            {['Evidence span', 'Labels', 'Layer', 'Conf.', 'Severity'].map((h) => (
              <th key={h} className="px-2.5 py-1.5 font-normal">
                <Kicker>{h}</Kicker>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((x) => (
            <tr key={x.id} className="border-t border-line/70 align-top">
              <td className="px-2.5 py-1.5" title={x.spanText}>
                <div className="truncate font-mono">{x.spanText}</div>
                <div className="font-mono text-[9.5px] text-ink-3">{x.entityType}</div>
              </td>
              <td className="px-2.5 py-1.5">
                <div className="flex flex-wrap gap-1">
                  {x.labels.map((l) => (
                    <CategoryChip key={l} c={l} primary={l === x.primaryCategory} />
                  ))}
                </div>
              </td>
              <td className="px-2.5 py-1.5 font-mono">{x.layer}</td>
              <td className="num px-2.5 py-1.5 font-mono">{pct(x.confidence)}</td>
              <td className="px-2.5 py-1.5">
                <RiskBadge level={x.severity} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {f.length > shown.length && <div className="border-t border-line px-2.5 py-1.5 text-[11px] text-ink-3">+ {f.length - shown.length} more findings of the same kinds</div>}
    </div>
  );
}

// ---------------------------------------------------------------- 6 Policy + risk

export function PolicyStage({ run }: { run: PipelineRun }) {
  const s = run.scenario;
  const dest = destinationOf(s.destinationTool);
  const c = riskVar(s.riskLevel);
  const relevant = new Set(s.findings.flatMap((f) => f.labels));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Readout label="Risk level" note="policy outcome">
          <RiskBadge level={s.riskLevel} size="lg" />
        </Readout>
        <Readout label="Risk score" note="0–100, after context">
          <div className="flex items-end gap-1">
            <span className="num font-mono text-[28px] font-semibold leading-none" style={{ color: c }}>
              {s.riskScore}
            </span>
            <span className="pb-0.5 font-mono text-[11px] text-ink-3">/100</span>
          </div>
          <Meter className="mt-2" value={s.riskScore / 100} color={c} />
        </Readout>
        <Readout label="Detection confidence" note="how sure, not how bad">
          <span className="num font-mono text-[28px] font-semibold leading-none">{pct(s.fusion.fusedConfidence)}</span>
          <Meter className="mt-2" value={s.fusion.fusedConfidence} color="var(--ink-2)" />
        </Readout>
      </div>
      <div className="flex flex-wrap gap-2 text-[11.5px]">
        <span className="rounded border border-line bg-panel px-2 py-1">
          Destination <span className="font-mono">{dest.label}</span> × <b className="font-mono">{dest.multiplier}</b>
        </span>
        {s.fusion.labelHierarchyNote?.startsWith('Combination') && <span className="rounded border border-line bg-panel px-2 py-1">Combination bonus applied</span>}
        {s.messages && <span className="rounded border border-high/50 bg-panel px-2 py-1 text-high">Session mosaic budget exceeded</span>}
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-[#101116] text-[#cfd0d6]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
          <span className="font-mono text-[10.5px] text-[#8a8c96]">policy.yaml · models detect, policy decides</span>
          <SimTag className="!border-white/20 !text-[#8a8c96]" />
        </div>
        <pre className="max-h-[170px] overflow-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed">
          {POLICY_YAML.split('\n').map((line, i) => {
            const hit = [...relevant].some((r) => line.includes(`${r}:`)) || (s.blocked && line.startsWith('honeytokens')) || line.includes(dest.label.split(' ')[0] + ':');
            return (
              <div key={i} className={hit ? 'bg-[#2b45ff]/25 text-white' : ''}>
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

function Readout({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <Kicker>{label}</Kicker>
      <div className="mt-1.5">{children}</div>
      <div className="mt-1.5 text-[10.5px] text-ink-3">{note}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 7 Explain / 8 Minimise

export function ExplainStage({ run }: { run: PipelineRun }) {
  return <ExplainerCard scenario={run.scenario} />;
}

export function MinimiseStage({ run }: { run: PipelineRun }) {
  if (run.scenario.blocked) return <SkippedNote />;
  return <MinimisationView scenario={run.scenario} />;
}

function SkippedNote() {
  return (
    <Callout icon="x" color="var(--critical)">
      Skipped: honeytoken requests are blocked before any transformation, so no sanitised text is produced.
    </Callout>
  );
}

// ---------------------------------------------------------------- 9 Mask

export function MaskStage({ run, animate }: { run: PipelineRun; animate: boolean }) {
  if (run.scenario.blocked) return <SkippedNote />;
  const v = run.verification!;
  const first = v.attempts[0].mask;
  if (run.table) {
    return (
      <div className="space-y-3">
        <Callout icon="layers">
          Structured data: minimisation removed {run.table.original.columns.length - run.table.kept.columns.length} columns. Only the kept column ({run.table.kept.columns.join(', ')}) is transformed and sent.
        </Callout>
        <div className="grid grid-cols-[1fr_auto_160px] items-start gap-3">
          <div className="rounded-lg border border-line bg-panel p-2">
            <Kicker className="mb-1">Original · stays local</Kicker>
            <pre className="max-h-[210px] overflow-auto font-mono text-[10.5px] leading-relaxed text-ink-3 blur-[1.5px] hover:blur-0">{tableToCsv(run.table.original)}</pre>
          </div>
          <Icon name="arrow" size={16} className="mt-16 text-ink-3" />
          <div className="rounded-lg border border-accent/40 bg-accent-soft p-2">
            <Kicker className="mb-1 !text-accent">Outbound</Kicker>
            <pre className="font-mono text-[11.5px] font-semibold leading-relaxed">{first.text}</pre>
          </div>
        </div>
        <VaultPanel vault={first.vault} compact />
      </div>
    );
  }
  if (first.replacements.length === 0) {
    return (
      <Callout icon="check" color="var(--safe)">
        Nothing to mask: no findings need transforming. The prompt is sent unchanged.
      </Callout>
    );
  }
  return (
    <div className="space-y-3">
      <DiffView content={run.scenario.content} result={first} animate={animate} mono={/\n/.test(run.scenario.content) && /[=:]/.test(run.scenario.content)} />
      <VaultPanel vault={first.vault} />
    </div>
  );
}

// ---------------------------------------------------------------- 10 Verify

export function VerifyStage({ run, animate }: { run: PipelineRun; animate: boolean }) {
  if (run.scenario.blocked) return <SkippedNote />;
  const v = run.verification!;
  const leakTerms = v.attempts[0].result.leaks.map((l) => l.found);
  return (
    <div className="space-y-3">
      <VerificationChecks
        outcome={v}
        animate={animate}
        qwenReview={run.scenario.escalateToQwenReview ? { note: run.scenario.qwenReviewNote ?? 'Inconclusive.', ms: QWEN_REVIEW_MS } : null}
      />
      {v.status === 'REPAIRED' && !run.table && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Kicker className="mb-1">Attempt 1 output (leak underlined)</Kicker>
            <DiffView content={run.scenario.content} result={v.attempts[0].mask} animate={false} leakTerms={leakTerms} bare />
          </div>
          <div>
            <Kicker className="mb-1">Final output (repaired)</Kicker>
            <DiffView content={run.scenario.content} result={v.final} animate={false} bare />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 11 Decision

export function DecisionExtras({
  run,
  decision,
  edited,
  setEdited,
  justification,
  setJustification,
  onConfirm,
}: {
  run: PipelineRun;
  decision: Decision | null;
  edited: string;
  setEdited: (v: string) => void;
  justification: string;
  setJustification: (v: string) => void;
  onConfirm: () => void;
}) {
  if (decision === 'EDIT') {
    const r = verify(edited, run.vault, { droppedValues: run.table?.droppedValues });
    return (
      <div className="space-y-2">
        <label className="block">
          <Kicker className="mb-1">Edit the sanitised text · re-verified live by verification.ts</Kicker>
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-lg border border-line-2 bg-panel p-2.5 font-mono text-[12px] leading-relaxed outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {r.checks.map((c) => (
            <span key={c.id} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${c.passed ? 'bg-safe/12 text-safe' : 'bg-critical/12 text-critical'}`} title={c.detail}>
              {c.passed ? '✓' : '✕'} {c.label}
            </span>
          ))}
        </div>
        <Btn variant="primary" disabled={!r.passed} onClick={onConfirm}>
          <Icon name="send" size={13} /> Re-verified: send edited version
        </Btn>
      </div>
    );
  }
  if (decision === 'OVERRIDE') {
    const ok = justification.trim().length >= 20;
    return (
      <div className="space-y-2">
        <label className="block">
          <Kicker className="mb-1">Written justification (logged as metadata, min 20 characters)</Kicker>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
            placeholder="e.g. This pricing plan was announced publicly at the partner summit on 12 Sept."
            className="w-full resize-y rounded-lg border border-line-2 bg-panel p-2.5 text-[12.5px] outline-none focus:border-accent"
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] text-ink-3">{justification.trim().length}/20 · overrides are rate-limited</span>
          <Btn variant="primary" disabled={!ok} onClick={onConfirm}>
            <Icon name="flag" size={13} /> Send with override
          </Btn>
        </div>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------- 12 Output

export function OutputStage({ run, decision, edited, animate }: { run: PipelineRun; decision: Decision | null; edited: string; animate: boolean }) {
  const s = run.scenario;
  if (!decision) return <div className="text-[12.5px] text-ink-3">Waiting for a decision.</div>;
  if (decision === 'BLOCK') return <BlockedCard run={run} />;
  if (decision === 'ANSWER_LOCALLY') return <LocalAnswer text={run.localAnswer ?? 'No local answer available.'} />;
  const outbound = decision === 'OVERRIDE' ? `${s.instruction}\n\n${s.content}`.trim() : decision === 'EDIT' ? `${s.instruction}\n\n${edited}` : (run.outboundPrompt ?? '');
  return (
    <div className="space-y-3">
      <OutboundBlock text={outbound} status={decision === 'OVERRIDE' ? 'override' : 'verified'} />
      {run.rehydrated && (
        <div className="rounded-lg border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
            <div className="flex items-center gap-2">
              <Kicker>AI reply</Kicker>
              <SimTag />
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-safe">
              <Icon name="lock" size={11} /> Restored on this device · rehydrate.ts
            </span>
          </div>
          <div className="max-h-[230px] overflow-auto px-3 py-2">
            <RehydrationView result={run.rehydrated} animate={animate} />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line px-3 py-1.5 font-mono text-[10.5px] text-ink-3">
            <span>{run.rehydrated.restoredCount} restored</span>
            {run.rehydrated.secretsKept > 0 && <span className="text-critical">{run.rehydrated.secretsKept} secrets kept masked (never restored)</span>}
            {run.rehydrated.unresolved.length > 0 && <span className="text-medium">{run.rehydrated.unresolved.length} unresolved</span>}
            {run.rehydrated.segments.some((x) => x.kind === 'restored' && x.raw !== x.placeholder) && <span>tolerant match: AI altered a placeholder's case or spacing</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function OutboundBlock({
  text,
  status,
  title = 'Outbound prompt: all the external AI receives',
}: {
  text: string;
  status: 'verified' | 'override' | 'ready';
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <Kicker>{title}</Kicker>
        {status === 'override' ? (
          <span className="font-mono text-[10px] text-high">OVERRIDE · justification logged</span>
        ) : (
          <span className="font-mono text-[10px] text-safe">{status === 'ready' ? 'VERIFIED · READY' : 'VERIFIED · SENT'}</span>
        )}
      </div>
      <pre className="max-h-[150px] overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2">
        {text.split(/(⟦[^⟧]*⟧)/).map((p, i) =>
          p.startsWith('⟦') ? (
            <span key={i} className="ph-chip">
              {p}
            </span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </pre>
    </div>
  );
}

export function LocalAnswer({ text }: { text: string }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: tint('var(--safe)', 40) }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: tint('var(--safe)', 10) }}>
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-safe">
          <Icon name="cpu" size={14} /> Answered by on-device Qwen: nothing left this device.
        </span>
        <SimTag />
      </div>
      <div className="whitespace-pre-wrap bg-panel px-3 py-2.5 text-[13px] leading-relaxed">{text}</div>
    </div>
  );
}

export function BlockedCard({ run }: { run: PipelineRun }) {
  // Real L0 check: hash the normalised content against the honeytoken registry.
  const hit = scanRules(run.normalised.text).find((m) => m.rule === 'HONEYTOKEN');
  const f = hit ? HONEYTOKEN_REGISTRY.find((r) => r.id === hit.honeytokenId) : undefined;
  return (
    <div className="overflow-hidden rounded-lg border-2" style={{ borderColor: 'var(--critical)' }}>
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: 'var(--critical)' }}>
        <Icon name="alert" size={16} />
        <span className="text-[13px] font-semibold">Request blocked{f ? ': honeytoken tripwire' : ''}</span>
      </div>
      <div className="space-y-1.5 bg-panel px-3 py-2.5 text-[12.5px]">
        {f && (
          <>
            <div>
              <span className="text-ink-3">Token </span>
              <span className="font-mono font-semibold">{f.id}</span>
              <span className="text-ink-3"> · planted in </span>
              {f.plantedIn}
            </div>
            <div className="text-ink-2">Security team alerted on the Admin Dashboard. This is an incident, not ordinary sensitive data.</div>
          </>
        )}
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-critical">
          <Icon name="lock" size={12} /> No sanitised text produced · override unavailable
        </div>
      </div>
    </div>
  );
}
