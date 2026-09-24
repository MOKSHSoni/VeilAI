import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FEEDBACK_QUEUE, type FeedbackItem } from '../data/feedback';
import { SCENARIOS } from '../data/scenarios';
import { store, useStore, type FeedbackStage } from '../lib/store';
import { demo, useDemo } from '../lib/demo';
import { RiskBadge } from '../components/RiskBadge';
import { Icon } from '../components/Icon';
import { Btn, CategoryChip, Kicker, Panel, PanelHeader, SimTag, tint } from '../components/ui';

/** Scenario whose allowlist variant a term unlocks, for the "re-run" link. */
const scenarioFor = (term?: string) => SCENARIOS.find((s) => s.stateVariants && s.findings.some((f) => f.spanText === term));

export function Feedback() {
  const stages = useStore((s) => s.feedback);
  const allowlist = useStore((s) => s.allowlist);
  const version = useStore((s) => s.allowlistVersion);
  const [selected, setSelected] = useState(FEEDBACK_QUEUE[0].id);
  const d = useDemo();
  const item = FEEDBACK_QUEUE.find((f) => f.id === selected)!;
  const stage = stages[item.id] ?? 'OPEN';

  // Demo: false positive → gate → approve on the Project Atlas item, then continue.
  const demoHere = d.step?.kind === 'feedback';
  const demoIndex = d.index;
  useEffect(() => {
    if (!demoHere || d.paused) return;
    const atlas = FEEDBACK_QUEUE.find((f) => f.term)!;
    const st = stages[atlas.id] ?? 'OPEN';
    const next: Record<FeedbackStage, (() => void) | null> = {
      OPEN: () => {
        setSelected(atlas.id);
        store.setFeedback(atlas.id, 'PROPOSED');
      },
      PROPOSED: null, // gate animation advances itself
      GATE_PASSED: () => store.setFeedback(atlas.id, 'AWAITING_APPROVAL'),
      AWAITING_APPROVAL: () => approve(atlas),
      APPLIED: () => demo.next(demoIndex),
      CONFIRMED: null,
      FALSE_NEGATIVE: null,
      FP_LOGGED: null,
    };
    const fn = next[st];
    if (!fn) return;
    const t = setTimeout(fn, st === 'APPLIED' ? 3500 : 1600);
    return () => clearTimeout(t);
  }, [demoHere, d.paused, stages, demoIndex]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Analyst Feedback</h1>
          <p className="text-[12.5px] text-ink-3">Adaptive Detection: learn the company's terms, with safety gates so learning can never weaken protection.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-[11px] text-ink-2">
          <Icon name="layers" size={13} className="text-accent" /> allowlist v{version} · {allowlist.length} term{allowlist.length === 1 ? '' : 's'}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3">
        <Panel>
          <PanelHeader kicker="Queue" title={`${FEEDBACK_QUEUE.length} findings to review`} right={<span className="font-mono text-[10.5px] text-ink-3">redacted evidence only</span>} />
          <ul className="divide-y divide-line">
            {FEEDBACK_QUEUE.map((f) => {
              const st = stages[f.id] ?? 'OPEN';
              const sel = f.id === selected;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(f.id)}
                    aria-current={sel ? 'true' : undefined}
                    className={`relative flex w-full flex-col gap-1.5 px-4 py-3 text-left transition ${sel ? 'bg-panel-2' : 'hover:bg-panel-2/60'}`}
                  >
                    {sel && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent" />}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CategoryChip c={f.category} primary />
                        <span className="truncate font-mono text-[10.5px] text-ink-3">{f.layer}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!f.suppressible && <Icon name="lock" size={12} className="text-critical" />}
                        <StageTag stage={st} />
                        <RiskBadge level={f.severity} size="sm" />
                      </div>
                    </div>
                    <div className="font-mono text-[11.5px] text-ink-2">{f.snippet}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {f.reason} · <span className="font-mono">{f.reportedBy}</span> · {f.department}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Detail key={item.id} item={item} stage={stage} />
      </div>
    </div>
  );
}

function approve(item: FeedbackItem) {
  if (item.term) store.addToAllowlist(item.term);
  store.setFeedback(item.id, 'APPLIED');
}

function StageTag({ stage }: { stage: FeedbackStage }) {
  if (stage === 'OPEN') return null;
  const map: Record<FeedbackStage, [string, string]> = {
    OPEN: ['', ''],
    CONFIRMED: ['CONFIRMED', 'var(--safe)'],
    FALSE_NEGATIVE: ['FN LOGGED', 'var(--medium)'],
    FP_LOGGED: ['FP LOGGED', 'var(--medium)'],
    PROPOSED: ['GATING', 'var(--accent)'],
    GATE_PASSED: ['GATE PASS', 'var(--accent)'],
    AWAITING_APPROVAL: ['2ND APPROVAL', 'var(--review)'],
    APPLIED: ['APPLIED', 'var(--safe)'],
  };
  const [label, c] = map[stage];
  return (
    <span className="rounded px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-wider" style={{ color: c, background: tint(c, 12) }}>
      {label}
    </span>
  );
}

function Detail({ item, stage }: { item: FeedbackItem; stage: FeedbackStage }) {
  const inFlow = ['PROPOSED', 'GATE_PASSED', 'AWAITING_APPROVAL', 'APPLIED'].includes(stage);
  const target = scenarioFor(item.term);

  // Regression gate: simulated benchmark re-run.
  useEffect(() => {
    if (stage !== 'PROPOSED') return;
    const t = setTimeout(() => store.setFeedback(item.id, 'GATE_PASSED'), 1800);
    return () => clearTimeout(t);
  }, [stage, item.id]);

  return (
    <Panel className="flex flex-col">
      <PanelHeader kicker="Finding" title={item.layer} right={<RiskBadge level={item.severity} />} />
      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-line bg-panel-2 px-3 py-2.5">
          <Kicker className="mb-1">Redacted evidence</Kicker>
          <div className="font-mono text-[12.5px]">{item.snippet}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-3">{item.reason}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Btn
            disabled={!item.suppressible || stage !== 'OPEN'}
            onClick={() => store.setFeedback(item.id, item.term ? 'PROPOSED' : 'FP_LOGGED')}
            title={!item.suppressible ? item.lockReason : undefined}
            className="!py-2"
          >
            <Icon name={item.suppressible ? 'x' : 'lock'} size={13} /> False positive
          </Btn>
          <Btn
            disabled={stage !== 'OPEN' || !!item.term}
            onClick={() => store.setFeedback(item.id, item.proposedUpdate ? 'PROPOSED' : 'FALSE_NEGATIVE')}
            className="!py-2"
          >
            <Icon name="flag" size={13} /> False negative
          </Btn>
          <Btn disabled={stage !== 'OPEN'} onClick={() => store.setFeedback(item.id, 'CONFIRMED')} className="!py-2">
            <Icon name="check" size={13} /> Confirm
          </Btn>
        </div>

        {!item.suppressible && (
          <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: tint('var(--critical)', 40), background: tint('var(--critical)', 6) }}>
            <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-critical" />
            <div>
              <div className="font-semibold text-critical">Cannot be suppressed</div>
              <div className="text-ink-2">{item.lockReason}</div>
            </div>
          </div>
        )}

        {stage === 'CONFIRMED' && <Note color="var(--safe)" icon="check" text="Confirmed as a true positive. Logged as a labelled example for the next L4 training round." />}
        {stage === 'FALSE_NEGATIVE' && <Note color="var(--medium)" icon="flag" text="Logged as a miss for the analyst backlog." />}
        {stage === 'FP_LOGGED' && <Note color="var(--medium)" icon="flag" text="False positive recorded. Repeated reports in this category raise its threshold slightly, after the regression gate." />}

        {inFlow && item.proposedUpdate && (
          <ol className="space-y-2" aria-label="Adaptive update workflow">
            <FlowStep n={1} state="done" title="Proposed update" detail={item.proposedUpdate} />
            <FlowStep
              n={2}
              state={stage === 'PROPOSED' ? 'active' : 'done'}
              title="Regression gate"
              detail={stage === 'PROPOSED' ? 'Re-running the 192-document benchmark set…' : item.regressionGate}
              sim
            />
            <FlowStep
              n={3}
              state={stage === 'PROPOSED' || stage === 'GATE_PASSED' ? (stage === 'GATE_PASSED' ? 'active' : 'pending') : stage === 'AWAITING_APPROVAL' ? 'active' : 'done'}
              title="Needs second analyst approval"
              detail="Two-person rule: stops an insider allowlisting their own leak."
              action={
                stage === 'GATE_PASSED' ? (
                  <Btn variant="secondary" onClick={() => store.setFeedback(item.id, 'AWAITING_APPROVAL')}>
                    Request approval
                  </Btn>
                ) : stage === 'AWAITING_APPROVAL' ? (
                  <Btn variant="primary" onClick={() => approve(item)}>
                    <Icon name="check" size={13} /> Approve as analyst a_2f91
                  </Btn>
                ) : null
              }
            />
            <FlowStep
              n={4}
              state={stage === 'APPLIED' ? 'done' : 'pending'}
              title={item.term ? 'Allowlist updated' : 'Rule shipped'}
              detail={stage === 'APPLIED' ? (item.term ? `"${item.term}" added in store.ts. Versioned, can be rolled back.` : 'Versioned and pushed to endpoints.') : 'Pushed to endpoints as a new versioned update.'}
              action={
                stage === 'APPLIED' && target ? (
                  <Link to={`/?scenario=${target.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-ink hover:brightness-110">
                    Re-run Scenario {target.id} <Icon name="arrow" size={13} />
                  </Link>
                ) : null
              }
            />
          </ol>
        )}

        {stage === 'OPEN' && item.suppressible && !item.proposedUpdate && (
          <p className="text-[12px] text-ink-3">No automatic update is proposed for this finding. Confirm it or log it for review.</p>
        )}
      </div>
    </Panel>
  );
}

function Note({ color, icon, text }: { color: string; icon: 'check' | 'flag'; text: string }) {
  return (
    <div className="rise flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]" style={{ color, background: tint(color, 10) }}>
      <Icon name={icon} size={14} /> {text}
    </div>
  );
}

function FlowStep({
  n,
  state,
  title,
  detail,
  action,
  sim,
}: {
  n: number;
  state: 'done' | 'active' | 'pending';
  title: string;
  detail?: string;
  action?: React.ReactNode;
  sim?: boolean;
}) {
  return (
    <li className={`rise flex items-start gap-3 rounded-lg border px-3 py-2.5 ${state === 'active' ? 'border-accent bg-accent-soft/50' : 'border-line bg-panel'} ${state === 'pending' ? 'opacity-50' : ''}`}>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${
          state === 'done' ? 'bg-ink text-bg' : state === 'active' ? 'node-active bg-accent text-accent-ink' : 'border border-line-2 text-ink-3'
        }`}
      >
        {state === 'done' ? <Icon name="check" size={11} strokeWidth={2.6} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          {title}
          {sim && <SimTag />}
        </div>
        {detail && <div className={`text-[12px] ${detail.includes('PASS') ? 'font-mono font-semibold text-safe' : 'text-ink-2'}`}>{detail}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
}
