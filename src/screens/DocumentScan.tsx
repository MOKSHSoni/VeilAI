import { useEffect, useState } from 'react';
import { DOCUMENT, DOC_PAGES } from '../data/documentScan';
import { RISK_LEVELS, type RiskLevel } from '../data/types';
import { Heatmap } from '../components/Heatmap';
import { RiskBadge } from '../components/RiskBadge';
import { Icon } from '../components/Icon';
import { Btn, CategoryChip, Kicker, Panel, PanelHeader, SimTag, fmtMs, pct } from '../components/ui';

const ORDER: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'];

export function DocumentScan() {
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setRevealed(0);
    setSelected(null);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= DOC_PAGES.length) clearInterval(t);
    }, 420);
    return () => clearInterval(t);
  }, [run]);

  const done = revealed >= DOC_PAGES.length;
  const scanned = DOC_PAGES.slice(0, revealed);
  const worst = ORDER.find((l) => scanned.some((p) => p.level === l)) ?? 'SAFE';
  const l5Pages = DOC_PAGES.filter((p) => p.l5Ran).length;
  const totalMs = DOC_PAGES.reduce((a, p) => a + p.latencyMs, 0);
  const page = DOC_PAGES.find((p) => p.page === (selected ?? (done ? 4 : -1)));

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Document Scan</h1>
          <p className="text-[12.5px] text-ink-3">Chunked page by page, so a sensitive sentence on page 4 is never lost in a long document.</p>
        </div>
        <Btn onClick={() => setRun((r) => r + 1)}>
          <Icon name="restart" size={13} /> Rescan
        </Btn>
      </header>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)] gap-3">
        <Panel>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-8 items-center justify-center rounded border border-line-2 bg-panel-2 font-mono text-[8px] font-bold text-critical">PDF</div>
              <div className="min-w-0">
                <div className="truncate font-mono text-[13px] font-semibold">{DOCUMENT.fileName}</div>
                <div className="font-mono text-[10.5px] text-ink-3">
                  {DOCUMENT.pages} pages · {DOCUMENT.sizeKb} KB · {revealed}/{DOCUMENT.pages} scanned
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SimTag />
              <RiskBadge level={worst} />
            </div>
          </div>
          <div className="h-1 bg-sunken">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${(revealed / DOC_PAGES.length) * 100}%` }} />
          </div>
          <div className="p-4">
            <Heatmap pages={DOC_PAGES} revealed={revealed} selected={page?.page ?? null} onSelect={setSelected} />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-ink-2">
              {RISK_LEVELS.filter((l) => l !== 'REVIEW').map((l) => (
                <span key={l} className="flex items-center gap-1.5">
                  <RiskBadge level={l} size="sm" />
                  <span className="num font-mono">{scanned.filter((p) => p.level === l).length}</span>
                </span>
              ))}
              <span className="ml-auto flex items-center gap-1.5">
                <span className="rounded bg-accent px-1 font-mono text-[9px] font-semibold text-accent-ink">L5</span> Qwen ran on this page
              </span>
            </div>
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-3">
          <Panel>
            <PanelHeader kicker="Gating router" title={`L5 ran on ${l5Pages} of ${DOCUMENT.pages} pages`} right={<SimTag />} />
            <div className="space-y-2 px-4 py-3 text-[12.5px] text-ink-2">
              <p>{DOCUMENT.gatingNote} Fast layers (L0–L4) cover every page in milliseconds; Qwen only reads pages with context cues or uncertainty.</p>
              <div className="flex items-center justify-between rounded-md bg-panel-2 px-3 py-2 font-mono text-[11.5px]">
                <span className="text-ink-3">simulated total</span>
                <span className="num font-semibold text-ink">{fmtMs(totalMs)}</span>
              </div>
              <p className="text-[11.5px] text-ink-3">{DOCUMENT.minimisationNote}</p>
            </div>
          </Panel>

          <Panel className="min-h-[250px] flex-1">
            {page ? (
              <div key={page.page} className="rise">
                <PanelHeader kicker={`Page ${page.page} of ${DOCUMENT.pages}`} title={page.title} right={<RiskBadge level={page.level} />} />
                <div className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap gap-3 font-mono text-[10.5px] text-ink-3">
                    <span>{page.findings.length} findings</span>
                    <span>L5 {page.l5Ran ? 'ran' : 'skipped by router'}</span>
                    <span>{fmtMs(page.latencyMs)}</span>
                  </div>
                  {page.findings.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line-2 px-3 py-4 text-center text-[12px] text-ink-3">All layers clear on this page.</div>
                  ) : (
                    <ul className="space-y-1.5">
                      {page.findings.map((f, i) => (
                        <li key={i} className="rounded-md border border-line bg-panel-2 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <CategoryChip c={f.category} primary />
                              <span className="font-mono text-[10px] text-ink-3">{f.entityType}</span>
                            </div>
                            <span className="font-mono text-[10.5px] text-ink-3">
                              {f.layer} · {pct(f.confidence)}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[11.5px] text-ink-2">{f.evidence}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-2 text-center text-[12.5px] text-ink-3">
                <Icon name="doc" size={22} />
                {done ? 'Click a page on the heatmap to see its findings.' : 'Scanning pages…'}
                <Kicker>evidence is redacted</Kicker>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
