import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ABLATION,
  ABLATION_HEADLINE,
  ABLATION_NOTE,
  BENCHMARK_SETUP,
  BY_CATEGORY,
  LONG_DOCUMENT,
  LONG_DOCUMENT_CONCLUSION,
  MODELS,
  OVERALL,
  SECURITY_FOOTNOTE,
} from '../data/benchmark';
import { AXIS, ChartTooltip, GRID } from '../components/ChartTooltip';
import { Icon } from '../components/Icon';
import { Kicker, Panel, PanelHeader } from '../components/ui';

const SERIES = [
  { key: 'q17b', name: MODELS[0], color: 'var(--series-a)' },
  { key: 'q4b', name: MODELS[1], color: 'var(--series-b)' },
] as const;

const SHORT: Record<string, string> = {
  CREDENTIALS: 'Credentials',
  CUSTOMER_INFORMATION: 'Customer',
  PERSONAL_INFORMATION: 'Personal',
  SECURITY: 'Security*',
  INTELLECTUAL_PROPERTY: 'IP',
  CONFIDENTIAL_BUSINESS: 'Business',
  FINANCIAL: 'Financial',
};

function MeasuredBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-safe/50 bg-safe/10 px-2 py-1 font-mono text-[10.5px] font-semibold tracking-wider text-safe">
      <Icon name="check" size={12} strokeWidth={2.4} /> REAL MEASURED DATA
    </span>
  );
}

export function Benchmark() {
  const chartData = BY_CATEGORY.map((r) => ({ ...r, label: SHORT[r.category] }));
  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Benchmark</h1>
          <p className="text-[12.5px] text-ink-3">LLM-only detection, measured. We found exactly where it fails and built a detector for each failure.</p>
        </div>
        <MeasuredBadge />
      </header>

      <div className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 text-[12.5px]">
        <span className="kicker">Setup</span>
        <span>
          <b className="num font-mono">{BENCHMARK_SETUP.documents}</b> documents
        </span>
        <span>
          <b className="num font-mono">{BENCHMARK_SETUP.sensitive}</b> sensitive · <b className="num font-mono">{BENCHMARK_SETUP.safe}</b> safe
        </span>
        <span className="font-mono text-[11.5px] text-ink-2">{BENCHMARK_SETUP.hardware}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
        <Panel>
          <PanelHeader kicker="Overall · LLM only" title="Qwen3 1.7B vs Qwen3 4B" />
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-panel-2 text-left">
                <th className="px-4 py-2 font-normal">
                  <Kicker>Metric</Kicker>
                </th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-4 py-2 text-right font-normal">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                      <Kicker>{s.name}</Kicker>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OVERALL.map((m) => (
                <tr key={m.metric} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-2">
                    {m.metric}
                    {m.lowerIsBetter && <span className="ml-1.5 font-mono text-[10px] text-ink-3">lower is better</span>}
                  </td>
                  <td className="num px-4 py-2 text-right font-mono">{m.q17b}</td>
                  <td className="num px-4 py-2 text-right font-mono">{m.q4b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line bg-panel-2 px-4 py-2.5 text-[12px] text-ink-2">
            High precision, low recall: the model is cautious, not confused. An LLM alone misses more than half of sensitive documents.
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            kicker="Recall by category"
            title="Neither model wins every category"
            right={
              <div className="flex items-center gap-3">
                {SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
            }
          />
          <div className="h-[252px] px-2 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 14, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%" barGap={2}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: 10.5 }} />
                <YAxis {...AXIS} axisLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" />
                <Tooltip cursor={{ fill: 'var(--panel-2)' }} content={<ChartTooltip unit="%" />} />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18}>
                    <LabelList dataKey={s.key} position="top" style={{ fill: 'var(--ink-3)', fontSize: 9 }} formatter={(v: number) => `${Math.round(v)}`} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="px-4 pb-3 text-[11px] leading-snug text-ink-3">
            <b className="text-ink-2">*</b> {SECURITY_FOOTNOTE}
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-3">
        <Panel>
          <PanelHeader kicker="By category" title="Recall per category, LLM only" />
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-panel-2 text-left">
                <th className="px-4 py-2 font-normal">
                  <Kicker>Category</Kicker>
                </th>
                <th className="px-4 py-2 text-right font-normal">
                  <Kicker>Docs</Kicker>
                </th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-4 py-2 text-right font-normal">
                    <Kicker>{s.name}</Kicker>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BY_CATEGORY.map((r) => (
                <tr key={r.category} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-1.5 font-mono text-[11.5px]">
                    {r.category}
                    {r.category === 'SECURITY' && <span className="text-ink-3">*</span>}
                  </td>
                  <td className="num px-4 py-1.5 text-right font-mono text-ink-3">{r.docs}</td>
                  <td className="num px-4 py-1.5 text-right font-mono">{r.q17b.toFixed(1)}%</td>
                  <td className="num px-4 py-1.5 text-right font-mono">{r.q4b.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader kicker="Long-document test" title="One hidden sensitive sentence" />
          <div className="grid grid-cols-4 gap-2 p-4">
            {LONG_DOCUMENT.map((r) => (
              <div
                key={r.pages}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center ${r.detected ? 'border-safe/40 bg-safe/8' : 'border-critical/40 bg-critical/6'}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${r.detected ? 'bg-safe/15 text-safe' : 'bg-critical/15 text-critical'}`}>
                  <Icon name={r.detected ? 'check' : 'x'} size={14} strokeWidth={2.4} />
                </span>
                <span className="font-mono text-[12px] font-semibold">{r.pages}</span>
                <span className="text-[11px] leading-tight text-ink-2">{r.result}</span>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-accent/35 bg-accent-soft/60 px-3 py-2 text-[12.5px]">
            <Icon name="layers" size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>{LONG_DOCUMENT_CONCLUSION}</span>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader kicker="Ablation · detection layers only" title={ABLATION_HEADLINE} />
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-panel-2 text-left">
              {['Step', 'Change', 'Recall', 'FNR', 'FPR'].map((h, i) => (
                <th key={h} className={`px-4 py-2 font-normal ${i >= 2 ? 'text-right' : ''}`}>
                  <Kicker>{h}</Kicker>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ABLATION.map((r) => (
              <tr key={r.step} className="border-b border-line/70 last:border-0">
                <td className="w-16 px-4 py-1.5 font-mono text-ink-3">{r.step}</td>
                <td className="px-4 py-1.5">{r.change}</td>
                <Cell v={r.recall} />
                <Cell v={r.fnr} />
                <Cell v={r.fpr} />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">{ABLATION_NOTE}</p>
      </Panel>
    </div>
  );
}

function Cell({ v }: { v: string | null }) {
  return (
    <td className="px-4 py-1.5 text-right">
      {v ? (
        <span className="num font-mono font-semibold">{v}</span>
      ) : (
        <span className="rounded border border-dashed border-line-2 px-1.5 py-px font-mono text-[10.5px] text-ink-3">To be measured</span>
      )}
    </td>
  );
}
