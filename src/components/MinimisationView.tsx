import type { MinAction, MinimisationItem, Scenario } from '../data/types';
import { Icon } from './Icon';
import { Kicker, tint } from './ui';

export const ACTION_STYLE: Record<MinAction, { color: string; label: string }> = {
  KEPT: { color: 'var(--safe)', label: 'KEPT' },
  DROPPED: { color: 'var(--critical)', label: 'DROPPED' },
  PSEUDONYMISED: { color: 'var(--accent)', label: 'PSEUDONYMISED' },
  GENERALISED: { color: 'var(--medium)', label: 'GENERALISED' },
};

export function ActionTag({ action }: { action: MinAction }) {
  const s = ACTION_STYLE[action];
  return (
    <span className="inline-flex rounded px-1.5 py-px font-mono text-[10px] font-semibold tracking-wider" style={{ color: s.color, background: tint(s.color, 12) }}>
      {s.label}
    </span>
  );
}

export function MinimisationView({ scenario }: { scenario: Scenario }) {
  const items = scenario.minimisation;
  const table = scenario.structuredData;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-lg border border-line bg-panel-2 px-3 py-2.5">
        <Icon name="layers" size={16} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <div className="text-[13px] font-medium">{scenario.minimisationSummary}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">
            Necessity matrix for <span className="font-mono">{scenario.taskType}</span>: the matrix decides, not the LLM.
          </div>
        </div>
      </div>

      {table ? <ColumnTable scenario={scenario} /> : items.length > 0 ? <ItemList items={items} /> : null}
    </div>
  );
}

function ItemList({ items }: { items: MinimisationItem[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
      {items.map((m, i) => (
        <li key={i} className="rise flex items-start gap-3 px-3 py-2" style={{ animationDelay: `${i * 90}ms` }}>
          <div className="w-[112px] shrink-0 pt-px">
            <ActionTag action={m.action} />
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium">{m.item}</div>
            <div className="text-[11.5px] text-ink-3">{m.reason}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ColumnTable({ scenario }: { scenario: Scenario }) {
  const t = scenario.structuredData!;
  const actionOf = (c: string) => scenario.minimisation.find((m) => m.column === c);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr>
              {t.columns.map((c, i) => {
                const a = actionOf(c);
                const dropped = a?.action === 'DROPPED';
                return (
                  <th key={c} className="rise border-b border-line px-2.5 py-2 text-left align-top font-normal" style={{ animationDelay: `${i * 110}ms` }}>
                    <div className={`font-mono text-[11.5px] font-semibold ${dropped ? 'text-ink-3 line-through' : 'text-ink'}`}>{c}</div>
                    {a && (
                      <div className="mt-1">
                        <ActionTag action={a.action} />
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="font-mono">
            {t.rows.slice(0, 4).map((r, ri) => (
              <tr key={ri} className="border-b border-line/60 last:border-0">
                {t.columns.map((c) => {
                  const dropped = actionOf(c)?.action === 'DROPPED';
                  return (
                    <td key={c} className={`whitespace-nowrap px-2.5 py-1 ${dropped ? 'select-none text-ink-3/70 blur-[3px]' : 'font-semibold text-ink'}`}>
                      {String(r[c])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line bg-panel-2 px-2.5 py-1.5">
        <Kicker>+ {t.rows.length - 4} more rows</Kicker>
        <span className="text-[11px] text-ink-3">Reasons: {scenario.minimisation.filter((m) => m.action === 'DROPPED').map((m) => `${m.column}: ${m.reason.toLowerCase()}`)[0]}…</span>
      </div>
    </div>
  );
}
