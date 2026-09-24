import { useEffect, useState } from 'react';
import type { MaskResult } from '../lib/masking';

type Seg = { kind: 'text'; text: string } | { kind: 'span'; text: string; placeholder: string; key: number };

function segmentsOf(content: string, m: MaskResult): Seg[] {
  const out: Seg[] = [];
  let cursor = 0;
  m.replacements.forEach((r, k) => {
    if (r.start > cursor) out.push({ kind: 'text', text: content.slice(cursor, r.start) });
    out.push({ kind: 'span', text: content.slice(r.start, r.end), placeholder: r.placeholder, key: k });
    cursor = r.end;
  });
  if (cursor < content.length) out.push({ kind: 'text', text: content.slice(cursor) });
  return out;
}

export type VeilPhase = 'original' | 'veiling' | 'masked';

/**
 * The signature "veil": sensitive spans are highlighted, frost over, then collapse into placeholder chips.
 * Offsets come straight from masking.ts replacements; nothing here decides what to mask.
 */
export function DiffView({
  content,
  result,
  animate = true,
  mono = false,
  leakTerms = [],
  className = '',
  bare = false,
}: {
  content: string;
  result: MaskResult;
  animate?: boolean;
  mono?: boolean;
  /** Text to flag as a residual leak (verification view). */
  leakTerms?: string[];
  className?: string;
  /** Hide the legend / peek toolbar (compact comparisons). */
  bare?: boolean;
}) {
  const [phase, setPhase] = useState<VeilPhase>(animate ? 'original' : 'masked');
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!animate) {
      setPhase('masked');
      return;
    }
    setPhase('original');
    const t1 = setTimeout(() => setPhase('veiling'), 350);
    const t2 = setTimeout(() => setPhase('masked'), 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [animate, result]);

  const segs = segmentsOf(content, result);
  const view: VeilPhase = showOriginal ? 'original' : phase;

  return (
    <div className={className}>
      {!bare && (
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="veil-span inline-block h-2.5 w-4" /> original span
            </span>
            <span className="flex items-center gap-1.5">
              <span className="ph-chip !px-1 !py-0 text-[9px]">⟦·⟧</span> placeholder
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-ink-2 hover:bg-panel-2"
            aria-pressed={showOriginal}
          >
            {showOriginal ? 'Show sanitised' : 'Peek original (local)'}
          </button>
        </div>
      )}
      <div
        className={`max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-sunken/60 p-3 text-[12.5px] leading-[1.75] ${
          mono ? 'font-mono text-[11.5px] leading-[1.7]' : ''
        }`}
      >
        {segs.map((s, i) => {
          if (s.kind === 'text') return <LeakText key={i} text={s.text} leakTerms={view === 'masked' ? leakTerms : []} />;
          if (view === 'original') return <span key={i} className="veil-span">{s.text}</span>;
          if (view === 'veiling')
            return (
              <span key={i} className="veil-span is-veiling" style={{ animationDelay: `${s.key * 60}ms` }}>
                {s.text}
              </span>
            );
          return (
            <span key={i} className="ph-chip is-in" style={{ animationDelay: `${s.key * 50}ms` }} title={`${s.placeholder}: original stays on this device`}>
              {s.placeholder}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function LeakText({ text, leakTerms }: { text: string; leakTerms: string[] }) {
  if (!leakTerms.length) return <>{text}</>;
  const re = new RegExp(`(${leakTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        leakTerms.includes(p) ? (
          <mark key={i} className="rounded bg-transparent px-0.5 text-critical underline decoration-critical decoration-wavy underline-offset-4">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
