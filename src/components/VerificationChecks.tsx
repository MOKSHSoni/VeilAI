import { useEffect, useState } from 'react';
import type { VerificationOutcome, VerifyResult } from '../lib/verification';
import { fmtMs, Kicker, SimTag, tint } from './ui';
import { Icon } from './Icon';

/** Shows each verification attempt; for a repaired run it plays fail → repair → pass. */
export function VerificationChecks({
  outcome,
  animate = true,
  qwenReview,
}: {
  outcome: VerificationOutcome;
  animate?: boolean;
  qwenReview?: { note: string; ms: number } | null;
}) {
  const total = outcome.attempts.length + (outcome.repairs.length ? 1 : 0) + (qwenReview ? 1 : 0);
  const [shown, setShown] = useState(animate ? 1 : total);

  useEffect(() => {
    if (!animate) {
      setShown(total);
      return;
    }
    setShown(1);
    const timers = Array.from({ length: total - 1 }, (_, i) => setTimeout(() => setShown(i + 2), (i + 1) * 800));
    return () => timers.forEach(clearTimeout);
  }, [animate, outcome, total]);

  const [a1, a2] = outcome.attempts;
  const blocks = [
    <Attempt key="a1" n={1} result={a1.result} />,
    ...(outcome.repairs.length
      ? [
          <div key="rep" className="rise rounded-lg border border-dashed px-3 py-2" style={{ borderColor: tint('var(--medium)', 60), background: tint('var(--medium)', 7) }}>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--medium)' }}>
              <Icon name="restart" size={14} /> Auto-repair
            </div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-ink-2">
              {outcome.repairs.map((r, i) => (
                <li key={i}>
                  {r.note} <span className="text-ink-3">→ re-mask, re-verify once</span>
                </li>
              ))}
            </ul>
          </div>,
        ]
      : []),
    ...(a2 ? [<Attempt key="a2" n={2} result={a2.result} />] : []),
    ...(qwenReview
      ? [
          <div key="qwen" className="rise rounded-lg border px-3 py-2" style={{ borderColor: tint('var(--review)', 45), background: tint('var(--review)', 7) }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--review)' }}>
                <Icon name="chip" size={14} /> Escalated Qwen review
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink-3">
                {fmtMs(qwenReview.ms)} <SimTag />
              </span>
            </div>
            <p className="mt-1 text-[12px] text-ink-2">{qwenReview.note}</p>
          </div>,
        ]
      : []),
  ];

  return (
    <div className="space-y-2">
      {blocks.slice(0, shown)}
      {shown >= total && (
        <div
          className="rise flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
          style={{
            color: outcome.status === 'REVIEW' ? 'var(--review)' : 'var(--safe)',
            background: tint(outcome.status === 'REVIEW' ? 'var(--review)' : 'var(--safe)', 10),
          }}
        >
          <Icon name={outcome.status === 'REVIEW' ? 'alert' : 'shield'} size={15} />
          {outcome.status === 'PASS' && 'Verification passed on first attempt. Deterministic, no second LLM pass.'}
          {outcome.status === 'REPAIRED' && 'Fail → repair → pass. The leak was caught and fixed before anything left the device.'}
          {outcome.status === 'REVIEW' && 'Still failing after one repair: routed to REVIEW.'}
        </div>
      )}
    </div>
  );
}

function Attempt({ n, result }: { n: number; result: VerifyResult }) {
  return (
    <div className="rise overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <Kicker>Attempt {n}</Kicker>
        <span className={`font-mono text-[10.5px] font-semibold ${result.passed ? 'text-safe' : 'text-critical'}`}>{result.passed ? 'PASS' : 'FAIL'}</span>
      </div>
      <ul className="divide-y divide-line/60">
        {result.checks.map((c, i) => (
          <li key={c.id} className="flex items-start gap-2.5 px-3 py-1.5">
            <span
              className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${c.passed ? 'bg-safe/15 text-safe' : 'bg-critical/15 text-critical'}`}
              aria-label={c.passed ? 'passed' : 'failed'}
            >
              <Icon name={c.passed ? 'check' : 'x'} size={10} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium">
                <span className="mr-1.5 font-mono text-[10px] text-ink-3">{i + 1}</span>
                {c.label}
              </div>
              <div className={`truncate text-[11px] ${c.passed ? 'text-ink-3' : 'text-critical'}`} title={c.detail}>
                {c.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
