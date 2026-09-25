import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SCENARIOS, getScenario } from '../data/scenarios';
import type { Decision, Scenario } from '../data/types';
import { runScenario, type PipelineRun } from '../lib/pipeline';
import { HONEYTOKEN_REGISTRY, scanRules } from '../lib/rules';
import { store, useStore } from '../lib/store';
import { demo, useDemo } from '../lib/demo';
import { PipelineStepper, type StepState } from '../components/PipelineStepper';
import { DecisionBar } from '../components/DecisionBar';
import { RiskBadge } from '../components/RiskBadge';
import { Icon } from '../components/Icon';
import { Kicker, Panel, SimTag, fmtMs, pct, riskVar } from '../components/ui';
import { Composer, type RunPhase } from '../components/scan/Composer';
import { TryOwnText } from '../components/scan/TryOwnText';
import {
  CaptureStage,
  DecisionExtras,
  OutboundBlock,
  DetectStage,
  ExplainStage,
  FusionStage,
  MaskStage,
  MinimiseStage,
  NormaliseStage,
  OutputStage,
  PolicyStage,
  TaskStage,
  VerifyStage,
} from '../components/scan/Stages';

const DECISION_STEP = 10;
const OUTPUT_STEP = 11;

export function Scan() {
  const [tab, setTab] = useState<'scenarios' | 'own'>('scenarios');
  const [params] = useSearchParams();
  const linked = Number(params.get('scenario'));
  const [selectedId, setSelectedId] = useState(SCENARIOS.some((s) => s.id === linked) ? linked : 6);
  const [nonce, setNonce] = useState(0);
  const allowlist = useStore((s) => s.allowlist);
  const allowlistVersion = useStore((s) => s.allowlistVersion);
  const d = useDemo();

  // Demo mode drives the scenario picker.
  const demoScenario = d.step?.kind === 'scenario' ? d.step.id : null;
  useEffect(() => {
    if (demoScenario !== null) {
      setTab('scenarios');
      setSelectedId(demoScenario);
      setNonce((n) => n + 1);
    }
  }, [demoScenario, d.index]);

  const select = (id: number) => {
    if (d.active) demo.stop();
    setSelectedId(id);
    setNonce((n) => n + 1);
  };

  const base = getScenario(selectedId);
  const autoPlay = d.active && demoScenario === selectedId;
  const demoIndex = d.index;
  const onFinished = useCallback(() => demo.next(demoIndex), [demoIndex]);

  return (
    <div className="flex flex-col gap-3 p-3 lg:h-full lg:min-h-[600px] lg:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 lg:gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Scan</h1>
          <span className="hidden truncate text-[12.5px] text-ink-3 md:block">Understand → detect → minimise → mask → verify → send safely</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Scan mode" className="flex rounded-lg border border-line bg-panel p-0.5">
            {(
              [
                ['scenarios', 'Demo scenarios'],
                ['own', 'Try your own text'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${tab === k ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (d.active ? demo.stop() : demo.start())}
            aria-pressed={d.active}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
              d.active ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 bg-panel hover:bg-panel-2'
            }`}
          >
            <span className={`relative h-3.5 w-6 rounded-full transition ${d.active ? 'bg-accent-ink/30' : 'bg-line-2'}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-current transition-all ${d.active ? 'left-3' : 'left-0.5'}`} />
            </span>
            Demo mode
          </button>
        </div>
      </header>

      {tab === 'own' ? (
        <div className="min-h-0 flex-1">
          <TryOwnText />
        </div>
      ) : (
        <>
          <ScenarioPicker selected={selectedId} onSelect={select} />
          <Workspace
            key={`${selectedId}-${nonce}-${allowlistVersion}`}
            base={base}
            allowlist={allowlist}
            autoPlay={autoPlay}
            paused={d.paused}
            onFinished={onFinished}
            onReplay={() => setNonce((n) => n + 1)}
          />
        </>
      )}
    </div>
  );
}

function ScenarioPicker({ selected, onSelect }: { selected: number; onSelect: (id: number) => void }) {
  return (
    <nav aria-label="Scenarios" className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 lg:mx-0 lg:grid lg:grid-cols-10 lg:overflow-visible lg:px-0 lg:pb-0">
      {SCENARIOS.map((s) => {
        const on = s.id === selected;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-current={on ? 'true' : undefined}
            className={`group w-[118px] min-w-0 shrink-0 rounded-lg border px-2 py-1.5 text-left transition lg:w-auto ${on ? 'border-ink bg-ink text-bg' : 'border-line bg-panel hover:border-line-2 hover:bg-panel-2'}`}
          >
            <div className={`font-mono text-[10px] font-semibold ${on ? 'text-accent' : 'text-ink-3'}`}>{String(s.id).padStart(2, '0')}</div>
            <div className="truncate text-[11.5px] font-medium leading-tight">{s.title}</div>
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- workspace (one scan)

function stepDuration(run: PipelineRun, i: number): number {
  const s = run.scenario;
  const blocked = !!s.blocked;
  const v = run.verification;
  switch (i) {
    case 0:
      return 600;
    case 1:
      return run.normalised.notes.length ? 1400 : 550;
    case 2:
      return 700;
    case 3:
      return 2000;
    case 4:
      return 1000;
    case 5:
      return 1000;
    case 6:
      return 1100;
    case 7:
      return blocked ? 300 : 1200;
    case 8:
      return blocked ? 300 : 1900;
    case 9: {
      if (blocked || !v) return 300;
      const blocks = v.attempts.length + (v.repairs.length ? 1 : 0) + (s.escalateToQwenReview ? 1 : 0);
      return 900 + blocks * 800;
    }
    default:
      return 600;
  }
}

function Workspace({
  base,
  allowlist,
  autoPlay,
  paused,
  onFinished,
  onReplay,
}: {
  base: Scenario;
  allowlist: string[];
  autoPlay: boolean;
  paused: boolean;
  onFinished: () => void;
  onReplay: () => void;
}) {
  const run = useMemo(() => runScenario(base, { allowlist }), [base, allowlist]);
  const s = run.scenario;
  const session = s.messages;

  const [phase, setPhase] = useState<RunPhase>('compose');
  const [sessionSent, setSessionSent] = useState(0);
  const [active, setActive] = useState(-1);
  const [view, setView] = useState<number | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [pending, setPending] = useState<Decision | null>(null); // EDIT / OVERRIDE awaiting confirmation
  const [edited, setEdited] = useState(run.sanitisedText ?? '');
  const [justification, setJustification] = useState('');

  const start = useCallback(() => {
    store.recordScan();
    setPhase('running');
    setActive(0);
  }, []);

  const onSend = useCallback(() => {
    if (session) {
      if (sessionSent < session.length - 1) setSessionSent((n) => n + 1);
      else if (sessionSent === session.length - 1) {
        setSessionSent(session.length);
        start();
      }
      return;
    }
    if (phase === 'compose') start();
  }, [session, sessionSent, phase, start]);

  const finalise = useCallback(
    (d: Decision) => {
      setDecision(d);
      setPending(null);
      setActive(OUTPUT_STEP);
      setView(null);
      setPhase('done');
      if (d === 'BLOCK' && s.blocked) {
        const hit = scanRules(run.normalised.text).find((m) => m.rule === 'HONEYTOKEN');
        const rec = HONEYTOKEN_REGISTRY.find((r) => r.id === hit?.honeytokenId);
        if (rec) store.raiseHoneytokenAlert(rec.id, rec.plantedIn);
      }
    },
    [s.blocked, run.normalised.text],
  );

  const choose = useCallback(
    (d: Decision) => {
      if (d === 'EDIT' || d === 'OVERRIDE') {
        setPending(d);
        setView(DECISION_STEP);
        return;
      }
      finalise(d);
    },
    [finalise],
  );

  // Step engine: presentation timing only. Displayed latencies come from simulatedTotalMs.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    if (active < DECISION_STEP) {
      const t = setTimeout(() => {
        setActive((a) => a + 1);
        setView(null);
      }, stepDuration(run, active));
      return () => clearTimeout(t);
    }
    if (active === DECISION_STEP) {
      if (s.blocked) {
        const t = setTimeout(() => finalise('BLOCK'), 900);
        return () => clearTimeout(t);
      }
      setPhase('decide');
    }
  }, [phase, active, paused, run, s.blocked, finalise]);

  // Demo: auto-accept the default decision, then move on.
  useEffect(() => {
    if (!autoPlay || paused || phase !== 'decide') return;
    const t = setTimeout(() => choose(s.defaultDecision), 1500);
    return () => clearTimeout(t);
  }, [autoPlay, paused, phase, choose, s.defaultDecision]);

  useEffect(() => {
    if (!autoPlay || paused || phase !== 'done') return;
    const t = setTimeout(onFinished, decision === 'SEND_SANITISED' ? 5200 : 4200);
    return () => clearTimeout(t);
  }, [autoPlay, paused, phase, decision, onFinished]);

  const states: StepState[] = run.timings.map((t, i) => {
    if (phase === 'done') return t.skipped ? 'skipped' : i === 3 && s.layerResults.some((l) => l.status === 'FLAGGED') ? 'flagged' : 'done';
    if (i < active) return t.skipped ? 'skipped' : i === 3 && s.layerResults.some((l) => l.status === 'FLAGGED') ? 'flagged' : 'done';
    if (i === active) return phase === 'decide' ? 'waiting' : 'active';
    return 'pending';
  });

  const shown = view ?? active;
  const riskKnown = active >= 5 || phase === 'done';

  return (
    <div className="flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(250px,290px)_232px_minmax(0,1fr)]">
      <Panel className="flex h-[440px] min-h-0 flex-col overflow-hidden lg:h-auto">
        <Composer run={run} phase={phase} sessionSent={sessionSent} decision={decision} onSend={onSend} autoType={autoPlay} paused={paused} />
      </Panel>

      <Panel className="order-3 h-[440px] min-h-0 overflow-hidden lg:order-none lg:h-auto">
        <PipelineStepper timings={run.timings} states={states} selected={shown} onSelect={setView} totalMs={s.simulatedTotalMs} finished={phase === 'done' || phase === 'decide'} />
      </Panel>

      <Panel className="order-2 flex min-h-[520px] flex-col overflow-hidden lg:order-none lg:min-h-0">
        <StageHeader run={run} index={shown} riskKnown={riskKnown} phase={phase} decision={decision} onReplay={onReplay} />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {shown < 0 ? (
            <Idle run={run} />
          ) : (
            <div key={shown} className="rise">
              <StageBody
                run={run}
                index={shown}
                animate={shown === active && phase === 'running'}
                decision={decision}
                pending={pending}
                phase={phase}
                choose={choose}
                edited={edited}
                setEdited={setEdited}
                justification={justification}
                setJustification={setJustification}
                confirm={() => pending && finalise(pending)}
              />
            </div>
          )}
        </div>
        {(phase === 'decide' || phase === 'done') && shown !== DECISION_STEP && (
          <div className="border-t border-line bg-panel-2 px-4 py-2.5">
            <DecisionBar
              enabled={run.enabledDecisions}
              recommended={s.defaultDecision}
              chosen={decision ?? pending}
              onChoose={phase === 'done' ? () => undefined : choose}
              risk={s.riskLevel}
              blocked={s.blocked}
              nothingMasked={!s.blocked && !run.vault.length && !run.table}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

const REAL: Record<number, string> = { 1: 'rules.ts', 8: 'masking.ts', 9: 'verification.ts', 11: 'rehydrate.ts' };
const SIMULATED = new Set([2, 3, 4, 5, 6]);

function StageHeader({
  run,
  index,
  riskKnown,
  phase,
  decision,
  onReplay,
}: {
  run: PipelineRun;
  index: number;
  riskKnown: boolean;
  phase: RunPhase;
  decision: Decision | null;
  onReplay: () => void;
}) {
  const s = run.scenario;
  const t = index >= 0 ? run.timings[index] : null;
  const real = index === OUTPUT_STEP ? (decision === 'BLOCK' ? 'rules.ts · L0 hash' : decision === 'ANSWER_LOCALLY' ? undefined : REAL[index]) : REAL[index];
  const sim = SIMULATED.has(index) || (index === OUTPUT_STEP && decision === 'ANSWER_LOCALLY');
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5" style={riskKnown ? { boxShadow: `inset 0 -2px 0 ${riskVar(s.riskLevel)}` } : undefined}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Kicker>{t ? `Step ${String(t.n).padStart(2, '0')} / 12` : `Scenario ${String(s.id).padStart(2, '0')}`}</Kicker>
          {t && real && (
            <span className="whitespace-nowrap rounded bg-ink px-1.5 font-mono text-[9px] font-semibold leading-[14px] tracking-wider text-bg" title="This step runs real deterministic code">
              RUNS FOR REAL · {real}
            </span>
          )}
          {t && sim && <SimTag />}
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight lg:truncate">{t ? t.label : s.title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {riskKnown && (
          <>
            <div className="text-right leading-tight">
              <div className="kicker">score · conf</div>
              <div className="num font-mono text-[12px]">
                {s.riskScore} · {pct(s.fusion.fusedConfidence)}
              </div>
            </div>
            <RiskBadge level={s.riskLevel} />
          </>
        )}
        {phase === 'done' && (
          <button type="button" onClick={onReplay} className="rounded-md border border-line p-1.5 text-ink-2 hover:bg-panel-2" aria-label="Replay scan" title="Replay">
            <Icon name="restart" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function Idle({ run }: { run: PipelineRun }) {
  const s = run.scenario;
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="relative mb-4 h-16 w-16">
        <div className="absolute inset-0 rounded-2xl border border-line-2" />
        <div className="absolute inset-2 rounded-xl border border-dashed border-accent/50" />
        <Icon name="shield" size={26} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" />
      </div>
      <Kicker>Scenario {String(s.id).padStart(2, '0')}</Kicker>
      <div className="font-display text-[20px] font-semibold tracking-tight">{s.title}</div>
      <p className="mt-1 max-w-sm text-[12.5px] text-ink-3">
        {s.messages ? `Send the ${s.messages.length} session messages one by one from the chat.` : 'Press Send in the chat. VeilAI intercepts the message and runs the 12-step pipeline on this device.'}
      </p>
      {run.allowlisted && (
        <div className="mt-3 rounded-md bg-safe/10 px-2.5 py-1 font-mono text-[11px] text-safe">Allowlist v2 active: analyst-approved update applied</div>
      )}
      <div className="mt-4 font-mono text-[10.5px] text-ink-3">simulated on-device total · {fmtMs(s.simulatedTotalMs)}</div>
    </div>
  );
}

function StageBody(p: {
  run: PipelineRun;
  index: number;
  animate: boolean;
  decision: Decision | null;
  pending: Decision | null;
  phase: RunPhase;
  choose: (d: Decision) => void;
  edited: string;
  setEdited: (v: string) => void;
  justification: string;
  setJustification: (v: string) => void;
  confirm: () => void;
}): ReactNode {
  const { run, index, animate } = p;
  switch (index) {
    case 0:
      return <CaptureStage run={run} />;
    case 1:
      return <NormaliseStage run={run} />;
    case 2:
      return <TaskStage run={run} />;
    case 3:
      return <DetectStage run={run} animate={animate} />;
    case 4:
      return <FusionStage run={run} />;
    case 5:
      return <PolicyStage run={run} />;
    case 6:
      return <ExplainStage run={run} />;
    case 7:
      return <MinimiseStage run={run} />;
    case 8:
      return <MaskStage run={run} animate={animate} />;
    case 9:
      return <VerifyStage run={run} animate={animate} />;
    case 10:
      return (
        <div className="space-y-3">
          <p className="text-[12.5px] text-ink-2">
            VeilAI transforms rather than blocks. The recommended action is highlighted; options outside policy are locked.
            {p.run.scenario.riskLevel === 'REVIEW' && ' You are never stuck in REVIEW: send the sanitised version, edit it, or override with a justification.'}
          </p>
          <DecisionBar
            enabled={run.enabledDecisions}
            recommended={run.scenario.defaultDecision}
            chosen={p.decision ?? p.pending}
            onChoose={p.phase === 'done' ? () => undefined : p.choose}
            risk={run.scenario.riskLevel}
            blocked={run.scenario.blocked}
            nothingMasked={!run.scenario.blocked && !run.vault.length && !run.table}
          />
          {p.phase === 'decide' && !p.pending && run.outboundPrompt && <OutboundBlock text={run.outboundPrompt} status="ready" title="If sent: the verified outbound prompt" />}
          <DecisionExtras
            run={run}
            decision={p.phase === 'done' ? null : p.pending}
            edited={p.edited}
            setEdited={p.setEdited}
            justification={p.justification}
            setJustification={p.setJustification}
            onConfirm={p.confirm}
          />
        </div>
      );
    default:
      return <OutputStage run={run} decision={p.decision} edited={p.edited} animate={p.phase === 'done'} />;
  }
}
