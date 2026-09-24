import { useEffect, useState } from 'react';
import type { RehydrateResult } from '../lib/rehydrate';
import { Icon } from './Icon';

/** Plays placeholders → real values. Secrets stay masked. */
export function RehydrationView({ result, animate = true, className = '' }: { result: RehydrateResult; animate?: boolean; className?: string }) {
  const [restored, setRestored] = useState(!animate);
  useEffect(() => {
    if (!animate) {
      setRestored(true);
      return;
    }
    setRestored(false);
    const t = setTimeout(() => setRestored(true), 900);
    return () => clearTimeout(t);
  }, [animate, result]);

  let k = 0;
  return (
    <div className={`whitespace-pre-wrap break-words text-[12.5px] leading-[1.75] ${className}`}>
      {result.segments.map((s, i) => {
        if (s.kind === 'text') return <span key={i}>{s.text}</span>;
        if (s.kind === 'unresolved')
          return (
            <span key={i} className="rounded bg-medium/15 px-1 font-mono text-medium" title="Unresolved placeholder">
              {s.raw}
            </span>
          );
        if (s.kind === 'secret')
          return (
            <span key={i} className="ph-chip inline-flex items-center gap-1" title="Secrets are never restored">
              <Icon name="lock" size={10} />
              {s.placeholder}
            </span>
          );
        const delay = k++ * 120;
        return restored ? (
          <span key={i} className="restored" style={{ animationDelay: `${delay}ms` }} title={`Restored from ${s.placeholder}${s.raw !== s.placeholder ? ` (AI wrote "${s.raw}")` : ''}`}>
            {s.value}
          </span>
        ) : (
          <span key={i} className="ph-chip">
            {s.raw}
          </span>
        );
      })}
    </div>
  );
}
