import type { StepTiming } from '../lib/pipeline';
import { Icon } from './Icon';
import { fmtMs, Kicker, SimTag } from './ui';

export type StepState = 'pending' | 'active' | 'done' | 'skipped' | 'flagged' | 'waiting';

const GROUPS: Record<number, string> = { 1: 'Input', 3: 'Intelligence', 5: 'Decision', 8: 'Action' };

export function PipelineStepper({
  timings,
  states,
  selected,
  onSelect,
  totalMs,
  finished,
}: {
  timings: StepTiming[];
  states: StepState[];
  selected: number;
  onSelect: (i: number) => void;
  totalMs: number;
  finished: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <Kicker>Pipeline trace</Kicker>
        <span className="font-mono text-[10px] text-ink-3">12 steps</span>
      </div>
      <ol className="relative min-h-0 flex-1 overflow-y-auto px-2" aria-label="Pipeline steps">
        {timings.map((t, i) => {
          const st = states[i];
          const clickable = st !== 'pending';
          const isSel = selected === i;
          return (
            <li key={t.id}>
              {GROUPS[t.n] && <div className="kicker mb-0.5 mt-1.5 pl-9 !text-[9px] !tracking-[0.16em] opacity-70">{GROUPS[t.n]}</div>}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect(i)}
                aria-current={isSel ? 'step' : undefined}
                className={`group relative flex w-full items-center gap-2.5 rounded-md py-[5px] pl-1 pr-2 text-left transition ${
                  isSel ? 'bg-panel-2' : clickable ? 'hover:bg-panel-2' : ''
                }`}
              >
                {i < timings.length - 1 && (
                  <span
                    className="absolute left-[13px] top-[24px] h-[calc(100%-10px)] w-px"
                    style={{ background: st === 'done' || st === 'flagged' || st === 'skipped' ? 'var(--ink-3)' : 'var(--line-2)' }}
                  />
                )}
                <Node state={st} n={t.n} />
                <span className={`min-w-0 flex-1 truncate text-[12.5px] ${st === 'pending' ? 'text-ink-3' : 'text-ink'} ${isSel ? 'font-semibold' : ''}`}>{t.label}</span>
                <span className="num shrink-0 font-mono text-[10.5px] text-ink-3">
                  {st === 'pending' || st === 'active' ? '' : t.skipped ? 'skip' : t.ms === null ? 'ext' : fmtMs(t.ms)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="m-2 rounded-lg border border-line bg-panel-2 p-3">
        <div className="flex items-center justify-between">
          <Kicker>Simulated total</Kicker>
          <SimTag />
        </div>
        <div className="num mt-0.5 font-mono text-[22px] font-semibold tracking-tight" aria-live="polite">
          {finished ? fmtMs(totalMs) : '—'}
        </div>
        <div className="text-[10.5px] leading-snug text-ink-3">On-device latency. The animation is slowed for presentation.</div>
      </div>
    </div>
  );
}

function Node({ state, n }: { state: StepState; n: number }) {
  const base = 'relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold ml-[4px]';
  switch (state) {
    case 'active':
      return <span className={`${base} node-active bg-accent text-accent-ink`}>{n}</span>;
    case 'waiting':
      return <span className={`${base} node-active border-2 border-accent bg-panel text-accent`}>{n}</span>;
    case 'done':
      return (
        <span className={`${base} bg-ink text-bg`}>
          <Icon name="check" size={11} strokeWidth={2.6} />
        </span>
      );
    case 'flagged':
      return (
        <span className={`${base} bg-critical text-white`}>
          <Icon name="flag" size={10} strokeWidth={2.4} />
        </span>
      );
    case 'skipped':
      return <span className={`${base} border border-dashed border-ink-3 bg-panel text-ink-3`}>–</span>;
    default:
      return <span className={`${base} border border-line-2 bg-panel text-ink-3`}>{n}</span>;
  }
}
