import type { PageView } from '../lib/documents';
import { riskVar, tint } from './ui';

const NO_MATCH = 'var(--ink-3)';

/** Clickable page heatmap: each tile is a page thumbnail tinted by its risk level. */
export function Heatmap({ pages, revealed, selected, onSelect }: { pages: PageView[]; revealed: number; selected: number | null; onSelect: (page: number) => void }) {
  const dense = pages.length > 10;
  return (
    <div role="listbox" aria-label="Page risk heatmap" className={`grid gap-3 ${dense ? 'grid-cols-4 gap-2 sm:grid-cols-8' : 'grid-cols-3 sm:grid-cols-5'}`}>
      {pages.map((p, i) => {
        const shown = i < revealed;
        const scanning = i === revealed;
        const c = p.level ? riskVar(p.level) : NO_MATCH;
        const sel = selected === p.page;
        const label = p.level ?? 'NO MATCH';
        return (
          <button
            key={p.page}
            type="button"
            role="option"
            aria-selected={sel}
            disabled={!shown}
            onClick={() => onSelect(p.page)}
            aria-label={`Page ${p.page}: ${shown ? (p.level ?? 'no rule match') : 'not scanned yet'}`}
            className={`group relative aspect-[3/4] overflow-hidden rounded-md border text-left transition ${sel ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : ''} ${
              shown ? 'hover:-translate-y-0.5 hover:shadow-md' : ''
            }`}
            style={{
              borderColor: shown ? tint(c, p.level ? 55 : 30) : 'var(--line)',
              background: shown ? tint(c, !p.level ? 5 : p.level === 'SAFE' ? 8 : 18) : 'var(--panel)',
            }}
          >
            {/* faux text lines */}
            <div className={`absolute inset-x-3 space-y-1.5 opacity-60 ${dense ? 'top-6' : 'top-8'}`}>
              {Array.from({ length: dense ? 5 : 9 }, (_, k) => (
                <div
                  key={k}
                  className="h-[3px] rounded-full"
                  style={{
                    width: `${55 + ((k * 37 + p.page * 13) % 40)}%`,
                    background: shown && p.findings.length && k % 3 === 1 ? c : 'var(--line-2)',
                  }}
                />
              ))}
            </div>
            {scanning && <div className="absolute inset-x-0 h-8 animate-[scan-line_900ms_linear_infinite] bg-gradient-to-b from-transparent via-accent/25 to-transparent" />}
            <div className="absolute left-2 top-1.5 font-mono text-[10px] font-semibold text-ink-2">P{String(p.page).padStart(2, '0')}</div>
            {shown && p.l5Ran && (
              <div className="absolute right-1.5 top-1.5 rounded bg-accent px-1 font-mono text-[9px] font-semibold text-accent-ink" title="L5 Qwen ran on this page">
                L5
              </div>
            )}
            {shown && (
              <div
                className={`rise absolute inset-x-1.5 bottom-1.5 flex items-center justify-between rounded px-1.5 py-0.5 font-mono font-semibold ${dense ? 'text-[8.5px]' : 'text-[9.5px]'}`}
                style={{ background: 'var(--panel)', color: c }}
              >
                <span className="truncate">{dense && !p.level ? '—' : label}</span>
                <span className="text-ink-3">{p.findings.length}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
