import type { LayerResult } from '../data/types';

/** Hybrid detection: deterministic L0–L4 and gated local Qwen (L5), merging into fusion. */
export function DetectionFork({ layers }: { layers: LayerResult[] }) {
  const det = layers.filter((l) => l.layer !== 'L5');
  const l5 = layers.find((l) => l.layer === 'L5');
  const detFlag = det.some((l) => l.status === 'FLAGGED');
  const qwenRan = l5 && l5.status !== 'SKIPPED';
  const stroke = (on: boolean) => (on ? 'var(--ink-2)' : 'var(--line-2)');
  return (
    <div className="relative select-none">
      <svg viewBox="0 0 520 112" className="h-[104px] w-full" aria-hidden="true">
        <path d="M260 22 V34 H120 V56" fill="none" stroke={stroke(true)} strokeWidth="1.5" />
        <path d="M260 34 H400 V56" fill="none" stroke={stroke(!!qwenRan)} strokeWidth="1.5" strokeDasharray={qwenRan ? '0' : '4 4'} />
        <path d="M120 82 V92 H260 V104" fill="none" stroke={stroke(true)} strokeWidth="1.5" />
        <path d="M400 82 V92 H260" fill="none" stroke={stroke(!!qwenRan)} strokeWidth="1.5" strokeDasharray={qwenRan ? '0' : '4 4'} />
        <circle cx="260" cy="34" r="3" fill="var(--ink-2)" />
        <circle cx="260" cy="92" r="3" fill="var(--ink-2)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 text-center">
        <Node className="left-1/2 top-0 -translate-x-1/2" label="DETECTION" strong />
        <Node className="left-[23%] top-[48px] -translate-x-1/2" label="Deterministic L0–L4" sub={detFlag ? 'flag on any' : 'all clear'} hot={detFlag} />
        <Node className="left-[77%] top-[48px] -translate-x-1/2" label="Local Qwen (L5)" sub={qwenRan ? 'via gating router' : 'gated · skipped'} accent dashed={!qwenRan} />
        <Node className="bottom-[-6px] left-1/2 -translate-x-1/2" label="FUSION" strong />
      </div>
    </div>
  );
}

function Node({ label, sub, className, strong, accent, dashed, hot }: { label: string; sub?: string; className: string; strong?: boolean; accent?: boolean; dashed?: boolean; hot?: boolean }) {
  return (
    <div
      className={`absolute rounded-md border px-2 py-0.5 ${className} ${strong ? 'border-ink bg-ink text-bg' : 'bg-panel'} ${dashed ? 'border-dashed' : ''} ${
        accent && !dashed ? 'border-accent' : hot ? 'border-critical' : strong ? '' : 'border-line-2'
      }`}
    >
      <div className={`whitespace-nowrap font-mono text-[10px] font-semibold tracking-wider ${accent && !dashed ? 'text-accent' : ''}`}>{label}</div>
      {sub && <div className="whitespace-nowrap text-[9.5px] text-ink-3">{sub}</div>}
    </div>
  );
}
