import { useEffect, useRef, useState, type DragEvent } from 'react';
import { DOCUMENT } from '../data/documentScan';
import { RISK_LEVELS } from '../data/types';
import { ACCEPT_ATTR, MAX_FILE_BYTES, checkFile, highestLevel, looksBinary, sampleDoc, scanFile, type ScannedDoc } from '../lib/documents';
import { downloadFile, reportFileName, reportHtml, reportJson } from '../lib/report';
import { Heatmap } from '../components/Heatmap';
import { RiskBadge } from '../components/RiskBadge';
import { Icon } from '../components/Icon';
import { Btn, CategoryChip, Kicker, Panel, PanelHeader, SimTag, fmtMs, pct } from '../components/ui';

// Added files live in memory for the session only (survive navigation, not reloads).
let sessionDocs: ScannedDoc[] | null = null;

export function DocumentScan() {
  const [docs, setDocs] = useState<ScannedDoc[]>(() => sessionDocs ?? [sampleDoc()]);
  const [activeId, setActiveId] = useState(docs[docs.length - 1].id);
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const doc = docs.find((d) => d.id === activeId) ?? docs[0];
  const isSample = doc.source === 'sample';

  useEffect(() => {
    sessionDocs = docs;
  }, [docs]);

  // Page-by-page reveal (presentation only; uploads are already scanned).
  useEffect(() => {
    setRevealed(0);
    setSelected(null);
    let i = 0;
    const step = isSample ? 420 : Math.max(40, Math.min(150, 1500 / doc.pages.length));
    const t = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= doc.pages.length) clearInterval(t);
    }, step);
    return () => clearInterval(t);
  }, [run, doc.id, doc.pages.length, isSample]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  async function addFiles(files: FileList | File[]) {
    const errs: string[] = [];
    const added: ScannedDoc[] = [];
    for (const f of Array.from(files)) {
      const check = checkFile(f.name, f.size);
      if (!check.ok) {
        errs.push(`${f.name}: ${check.reason}`);
        continue;
      }
      const text = await f.text();
      if (looksBinary(text)) {
        errs.push(`${f.name}: does not look like a text file.`);
        continue;
      }
      added.push(scanFile(f.name, text, f.size));
    }
    setErrors(errs);
    if (added.length) {
      setDocs((d) => [...d, ...added]);
      setActiveId(added[added.length - 1].id);
    }
  }

  function removeDoc(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    if (id === activeId) setActiveId(docs[0].id);
  }

  function exportReport(kind: 'html' | 'json') {
    setMenu(false);
    const now = new Date();
    if (kind === 'html') downloadFile(reportFileName(doc, 'html', now), reportHtml(doc, now), 'text/html');
    else downloadFile(reportFileName(doc, 'json', now), reportJson(doc, now), 'application/json');
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  const done = revealed >= doc.pages.length;
  const scanned = doc.pages.slice(0, revealed);
  const worst = highestLevel(scanned.map((p) => p.level));
  const defaultPage = isSample ? 4 : (doc.pages.find((p) => p.level === highestLevel(doc.pages.map((x) => x.level)))?.page ?? 1);
  const page = doc.pages.find((p) => p.page === (selected ?? (done ? defaultPage : -1)));
  const l5Pages = doc.pages.filter((p) => p.l5Ran).length;
  const noMatch = scanned.filter((p) => !p.level).length;

  return (
    <div
      className="relative flex flex-col gap-3 p-3 sm:p-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent bg-accent-soft/80 backdrop-blur-sm">
          <Icon name="doc" size={28} className="text-accent" />
          <div className="text-[15px] font-semibold text-ink">Drop text files to scan on this device</div>
          <div className="text-[12px] text-ink-2">Nothing is uploaded: files are read and scanned in your browser.</div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Document Scan</h1>
          <p className="text-[12.5px] text-ink-3">Chunked page by page, so a sensitive sentence deep inside a long document is never lost.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Btn variant="primary" onClick={() => inputRef.current?.click()}>
            <Icon name="doc" size={13} /> Add file
          </Btn>
          <div ref={menuRef} className="relative">
            <Btn onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} disabled={!done}>
              <Icon name="arrow" size={13} className="rotate-90" /> Export report
            </Btn>
            {menu && (
              <div role="menu" className="rise absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
                <MenuItem title="HTML report" sub="Readable; print to PDF from the browser" onClick={() => exportReport('html')} />
                <MenuItem title="JSON report" sub="Machine-readable, for SIEM or audit" onClick={() => exportReport('json')} />
                <div className="border-t border-line bg-panel-2 px-3 py-1.5 text-[10.5px] text-ink-3">Evidence is redacted. Generated locally.</div>
              </div>
            )}
          </div>
          <Btn onClick={() => setRun((r) => r + 1)} aria-label="Rescan">
            <Icon name="restart" size={13} />
          </Btn>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Scanned files">
        {docs.map((d) => {
          const on = d.id === doc.id;
          const lvl = highestLevel(d.pages.map((p) => p.level));
          return (
            <div
              key={d.id}
              className={`flex items-center overflow-hidden rounded-lg border text-[12px] ${on ? 'border-ink bg-ink text-bg' : 'border-line bg-panel hover:bg-panel-2'}`}
            >
              <button type="button" role="tab" aria-selected={on} onClick={() => setActiveId(d.id)} className="flex items-center gap-2 py-1.5 pl-2.5 pr-2">
                <span className={`font-mono text-[9px] font-bold ${on ? 'text-accent' : 'text-ink-3'}`}>{d.source === 'sample' ? 'SAMPLE' : 'FILE'}</span>
                <span className="max-w-[180px] truncate font-medium">{d.fileName}</span>
                <span className="font-mono text-[10px] opacity-70">{lvl ?? 'no match'}</span>
              </button>
              {d.source === 'upload' && (
                <button type="button" onClick={() => removeDoc(d.id)} aria-label={`Remove ${d.fileName}`} className="px-1.5 py-1.5 opacity-60 hover:opacity-100">
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-dashed border-line-2 px-2.5 py-1.5 text-[12px] text-ink-3 hover:border-accent hover:text-accent"
        >
          + drop or add text files · max {MAX_FILE_BYTES / 1024 / 1024} MB
        </button>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-medium/50 bg-medium/10 px-3 py-2 text-[12px]">
          <ul className="space-y-0.5 text-ink-2">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setErrors([])} aria-label="Dismiss" className="text-ink-3 hover:text-ink">
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
        <Panel>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-8 items-center justify-center rounded border border-line-2 bg-panel-2 font-mono text-[8px] font-bold text-critical">
                {(doc.fileName.split('.').pop() ?? 'TXT').slice(0, 4).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-mono text-[13px] font-semibold">{doc.fileName}</div>
                <div className="font-mono text-[10.5px] text-ink-3">
                  {doc.pages.length} page{doc.pages.length === 1 ? '' : 's'} · {(doc.sizeBytes / 1024).toFixed(1)} KB · {Math.min(revealed, doc.pages.length)}/{doc.pages.length} scanned
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSample ? <SimTag /> : <RulesOnlyTag />}
              {worst ? <RiskBadge level={worst} /> : <NoMatchBadge />}
            </div>
          </div>
          <div className="h-1 bg-sunken">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${(Math.min(revealed, doc.pages.length) / doc.pages.length) * 100}%` }} />
          </div>
          <div className={`p-4 ${doc.pages.length > 24 ? 'max-h-[440px] overflow-y-auto' : ''}`}>
            <Heatmap pages={doc.pages} revealed={revealed} selected={page?.page ?? null} onSelect={setSelected} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-[11.5px] text-ink-2">
            {RISK_LEVELS.filter((l) => l !== 'REVIEW' && (isSample || l !== 'SAFE')).map((l) => (
              <span key={l} className="flex items-center gap-1.5">
                <RiskBadge level={l} size="sm" />
                <span className="num font-mono">{scanned.filter((p) => p.level === l).length}</span>
              </span>
            ))}
            {!isSample && (
              <span className="flex items-center gap-1.5">
                <NoMatchBadge small />
                <span className="num font-mono">{noMatch}</span>
              </span>
            )}
            {isSample && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="rounded bg-accent px-1 font-mono text-[9px] font-semibold text-accent-ink">L5</span> Qwen ran on this page
              </span>
            )}
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-3">
          {isSample ? (
            <Panel>
              <PanelHeader kicker="Gating router" title={`L5 ran on ${l5Pages} of ${doc.pages.length} pages`} right={<SimTag />} />
              <div className="space-y-2 px-4 py-3 text-[12.5px] text-ink-2">
                <p>{DOCUMENT.gatingNote} Fast layers (L0–L4) cover every page in milliseconds; Qwen only reads pages with context cues or uncertainty.</p>
                <div className="flex items-center justify-between rounded-md bg-panel-2 px-3 py-2 font-mono text-[11.5px]">
                  <span className="text-ink-3">simulated total</span>
                  <span className="num font-semibold text-ink">{fmtMs(doc.totalMs)}</span>
                </div>
                <p className="text-[11.5px] text-ink-3">{DOCUMENT.minimisationNote}</p>
              </div>
            </Panel>
          ) : (
            <Panel>
              <PanelHeader kicker="Scan mode" title="Rules only, running for real" right={<RulesOnlyTag />} />
              <div className="space-y-2 px-4 py-3 text-[12.5px] text-ink-2">
                <p>
                  This file was scanned in your browser by <span className="font-mono">rules.ts</span>: normaliser, L0 honeytokens and L1 rules (regex, Luhn, Verhoeff). L2–L5 are not simulated
                  for added files, so contextual secrets (deals, strategy, IP) are not detected here.
                </p>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <Metric k="measured" v={fmtMs(doc.totalMs)} />
                  <Metric k="characters" v={doc.chars.toLocaleString('en-IN')} />
                  <Metric k="findings" v={String(doc.pages.reduce((a, p) => a + p.findings.length, 0))} />
                </div>
                <p className="text-[11.5px] text-ink-3">&ldquo;No match&rdquo; is not a SAFE verdict: only known patterns were checked.</p>
              </div>
            </Panel>
          )}

          <Panel className="min-h-[250px] flex-1">
            {page ? (
              <div key={`${doc.id}-${page.page}`} className="rise">
                <PanelHeader kicker={`Page ${page.page} of ${doc.pages.length}`} title={page.title} right={page.level ? <RiskBadge level={page.level} /> : <NoMatchBadge />} />
                <div className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap gap-3 font-mono text-[10.5px] text-ink-3">
                    <span>{page.findings.length} findings</span>
                    {isSample && <span>L5 {page.l5Ran ? 'ran' : 'skipped by router'}</span>}
                    <span>
                      {fmtMs(page.latencyMs)} {isSample ? '' : 'measured'}
                    </span>
                  </div>
                  {page.findings.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line-2 px-3 py-4 text-center text-[12px] text-ink-3">
                      {isSample ? 'All layers clear on this page.' : 'No known pattern on this page (contextual layers not run).'}
                    </div>
                  ) : (
                    <ul className="max-h-[300px] space-y-1.5 overflow-y-auto">
                      {page.findings.map((f, i) => (
                        <li key={i} className="rounded-md border border-line bg-panel-2 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <CategoryChip c={f.category} primary />
                              <span className="truncate font-mono text-[10px] text-ink-3">{f.rule ?? f.entityType}</span>
                            </div>
                            <span className="shrink-0 font-mono text-[10.5px] text-ink-3">
                              {f.layer}
                              {f.confidence !== undefined ? ` · ${pct(f.confidence)}` : ''}
                            </span>
                          </div>
                          <div className="mt-1 break-all font-mono text-[11.5px] text-ink-2">{f.evidence}</div>
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

function MenuItem({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-panel-2 focus:bg-panel-2">
      <span className="text-[12.5px] font-medium">{title}</span>
      <span className="text-[11px] text-ink-3">{sub}</span>
    </button>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-panel-2 px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-ink-3">{k}</div>
      <div className="num font-semibold text-ink">{v}</div>
    </div>
  );
}

function RulesOnlyTag() {
  return (
    <span className="whitespace-nowrap rounded bg-ink px-1.5 font-mono text-[9px] font-semibold leading-[16px] tracking-wider text-bg" title="Real code: rules.ts">
      RULES ONLY · REAL
    </span>
  );
}

function NoMatchBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-dashed border-line-2 font-mono font-semibold tracking-wider text-ink-3 ${small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
      title="No known pattern found. Not a SAFE verdict."
    >
      – NO MATCH
    </span>
  );
}
