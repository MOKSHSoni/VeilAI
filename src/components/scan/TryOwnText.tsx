import { useMemo, useState } from 'react';
import { normalise, scanRules, type RuleMatch } from '../../lib/rules';
import { mask } from '../../lib/masking';
import { verify } from '../../lib/verification';
import { Icon } from '../Icon';
import { RiskBadge } from '../RiskBadge';
import { CategoryChip, Kicker, Panel, PanelHeader } from '../ui';
import { DiffView } from '../DiffView';

const SAMPLE = `Hi team, the new vendor contact is priya.nair@example.com, +91 98765 43210.
Card on file: 4111 1111 1111 1111. PAN ABCDE1234F.
Staging key: s k _ t e s t _ 5 1 H x Q m P k Z r T y W 8 a B c D e F
Aadhaar 2345 6789 0124 (please verify)`;

export function TryOwnText() {
  const [text, setText] = useState(SAMPLE);
  const { normalised, matches, masked, result } = useMemo(() => {
    const n = normalise(text);
    const m = scanRules(n.text);
    const mk = mask(n.text, m.map((x) => ({ original: x.value, entityType: x.entityType, category: x.primaryCategory })));
    return { normalised: n, matches: m, masked: mk, result: verify(mk.text, mk.vault) };
  }, [text]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3">
      <Panel className="flex min-h-0 flex-col">
        <PanelHeader
          kicker="Try your own text"
          title="Paste anything: it never leaves this page"
          right={<span className="rounded border border-dashed border-medium px-1.5 py-0.5 font-mono text-[10px] font-semibold text-medium">SIMULATED RULES ONLY</span>}
        />
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <label htmlFor="own-text" className="sr-only">
            Text to scan
          </label>
          <textarea
            id="own-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-lg border border-line-2 bg-panel p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-accent"
          />
          <p className="mt-2 text-[11.5px] leading-snug text-ink-3">
            Runs the real <span className="font-mono">rules.ts</span> (L0 honeytokens + L1 regex, Luhn and Verhoeff) plus the normaliser, <span className="font-mono">masking.ts</span> and{' '}
            <span className="font-mono">verification.ts</span>. L2–L5 are not simulated for free text, so contextual secrets will not be caught here.
          </p>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col">
        <PanelHeader
          kicker="Live result"
          title={`${matches.length} pattern match${matches.length === 1 ? '' : 'es'}`}
          right={<RiskBadge level={matches.some((m) => m.severity === 'CRITICAL') ? 'CRITICAL' : matches.length ? 'HIGH' : 'SAFE'} size="sm" />}
        />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {normalised.notes.length > 0 && (
            <div className="space-y-1">
              <Kicker>Normalised</Kicker>
              {normalised.notes.map((n, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="truncate text-ink-3">{n.before}</span>
                  <Icon name="arrow" size={12} className="shrink-0 text-ink-3" />
                  <span className="truncate font-semibold text-critical">{n.after}</span>
                  <span className="shrink-0 text-[10px] text-ink-3">({n.method})</span>
                </div>
              ))}
            </div>
          )}
          <MatchTable matches={matches} />
          {matches.length > 0 && (
            <div>
              <Kicker className="mb-1">Masked (masking.ts) · verification {result.passed ? 'PASS' : 'FAIL'}</Kicker>
              <DiffView content={normalised.text} result={masked} animate={false} mono />
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function MatchTable({ matches }: { matches: RuleMatch[] }) {
  if (!matches.length) return <div className="rounded-lg border border-dashed border-line-2 px-3 py-4 text-center text-[12px] text-ink-3">No known patterns found.</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-[11.5px]">
        <thead className="bg-panel-2 text-left">
          <tr>
            {['Rule', 'Value', 'Category', 'Severity'].map((h) => (
              <th key={h} className="px-2.5 py-1.5 font-normal">
                <Kicker>{h}</Kicker>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => (
            <tr key={i} className="border-t border-line/70">
              <td className="whitespace-nowrap px-2.5 py-1.5">{m.label}</td>
              <td className="max-w-[160px] truncate px-2.5 py-1.5 font-mono" title={m.value}>
                {m.value}
              </td>
              <td className="px-2.5 py-1.5">
                <CategoryChip c={m.primaryCategory} primary />
              </td>
              <td className="px-2.5 py-1.5">
                <RiskBadge level={m.severity} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
