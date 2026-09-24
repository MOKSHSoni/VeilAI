import type { Scenario } from '../data/types';
import { RiskBadge } from './RiskBadge';
import { riskVar, SimTag } from './ui';

const ROWS: { key: keyof Scenario['explanation']; label: string }[] = [
  { key: 'found', label: 'Found' },
  { key: 'where', label: 'Where' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'whyItMatters', label: 'Why it matters' },
  { key: 'regulation', label: 'Regulation / policy' },
  { key: 'recommended', label: 'Recommended' },
];

export function ExplainerCard({ scenario }: { scenario: Scenario }) {
  const e = scenario.explanation;
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${riskVar(scenario.riskLevel)}` }}>
        <div className="flex items-center gap-2">
          <RiskBadge level={scenario.riskLevel} size="sm" />
          <span className="text-[12.5px] font-semibold">{scenario.findings[0]?.primaryCategory.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) ?? 'No exposure'}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
          template-filled, not free LLM text <SimTag />
        </span>
      </div>
      <dl className="grid grid-cols-[128px_1fr] text-[12.5px]">
        {ROWS.map((r) => (
          <div key={r.key} className="contents">
            <dt className="border-t border-line/70 px-3 py-1.5 text-ink-3 first:border-t-0">{r.label}</dt>
            <dd
              className={`border-t border-line/70 px-3 py-1.5 ${r.key === 'evidence' ? 'font-mono text-[11.5px]' : ''} ${r.key === 'recommended' ? 'font-medium text-ink' : 'text-ink-2'}`}
            >
              {e[r.key]}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
