import { LAYER_NAMES, type LayerResult } from '../data/types';
import { fmtMs, StatusPill } from './ui';

const METHOD: Record<string, string> = {
  L0: 'Hash match',
  L1: 'Regex · checksum · entropy',
  L2: 'Presidio + GLiNER',
  L3: 'MinHash · dictionaries',
  L4: 'Cue rules · classifier',
  L5: 'Ollama · Qwen3 4B',
};

export function LayerCard({ result, delay = 0, revealed = true }: { result: LayerResult; delay?: number; revealed?: boolean }) {
  const isQwen = result.layer === 'L5';
  const flagged = result.status === 'FLAGGED';
  return (
    <div
      className={`relative flex flex-col gap-1.5 overflow-hidden rounded-lg border bg-panel p-2.5 transition ${revealed ? 'rise' : 'opacity-0'} ${
        flagged ? 'border-critical/40' : 'border-line'
      } ${result.status === 'SKIPPED' ? 'border-dashed' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {flagged && <span className="absolute inset-y-0 left-0 w-[3px] bg-critical" />}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`rounded px-1 font-mono text-[10.5px] font-semibold ${isQwen ? 'bg-accent text-accent-ink' : 'bg-ink text-bg'}`}>{result.layer}</span>
          <span className="truncate text-[12.5px] font-medium">{LAYER_NAMES[result.layer]}</span>
        </div>
        <StatusPill status={result.status} />
      </div>
      <div className="font-mono text-[10px] text-ink-3">{METHOD[result.layer]}</div>
      <p className="line-clamp-2 min-h-[2.4em] text-[11.5px] leading-snug text-ink-2">{result.note}</p>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-1.5 font-mono text-[10.5px] text-ink-3">
        <span>
          {result.findingIds.length} finding{result.findingIds.length === 1 ? '' : 's'}
        </span>
        <span className="num">{result.status === 'SKIPPED' ? '— gated' : fmtMs(result.latencyMs)}</span>
      </div>
    </div>
  );
}
