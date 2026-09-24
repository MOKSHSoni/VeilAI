import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EVENTS_BY_CATEGORY, EVENTS_BY_TOOL, HONEYTOKEN_EVENT, KPIS, RECENT_EVENTS, RISK_WEEK } from '../data/dashboard';
import type { RiskLevel } from '../data/types';
import { useStore } from '../lib/store';
import { KpiCard } from '../components/KpiCard';
import { RiskBadge } from '../components/RiskBadge';
import { Icon } from '../components/Icon';
import { AXIS, ChartTooltip, GRID } from '../components/ChartTooltip';
import { Kicker, Panel, PanelHeader, SimTag, riskVar } from '../components/ui';

const WEEK_SERIES: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'REVIEW'];

export function Dashboard() {
  const alert = useStore((s) => s.honeytokenAlert);
  const scansRun = useStore((s) => s.scansRun);
  const events = alert ? [{ ...HONEYTOKEN_EVENT, time: alert.at }, ...RECENT_EVENTS] : RECENT_EVENTS;

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-[12.5px] text-ink-3">Organisation-wide visibility without surveillance.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-safe/40 bg-safe/10 px-3 py-1.5 text-[12.5px] font-medium text-safe">
          <Icon name="lock" size={14} /> No prompt content is stored: metadata only.
        </div>
      </header>

      {alert && (
        <div role="alert" className="rise flex items-center gap-4 overflow-hidden rounded-xl border-2 border-critical bg-panel">
          <div className="flex items-center gap-2 self-stretch bg-critical px-4 text-white">
            <Icon name="alert" size={18} />
            <span className="font-mono text-[11px] font-semibold tracking-wider">HONEYTOKEN ALERT</span>
          </div>
          <div className="min-w-0 flex-1 py-2.5">
            <div className="text-[14px] font-semibold">
              Honeytoken {alert.tokenId} detected · Planted in {alert.source} · Request blocked
            </div>
            <div className="text-[12px] text-ink-3">
              {alert.at} · {HONEYTOKEN_EVENT.department} · {HONEYTOKEN_EVENT.tool} · user <span className="font-mono">{HONEYTOKEN_EVENT.userHash}</span> · near-zero false-positive signal: the source system has leaked
            </div>
          </div>
          <span className="mr-4 hidden shrink-0 rounded border border-critical/50 px-2 py-1 font-mono text-[10.5px] text-critical xl:block">OVERRIDE: NEVER</span>
        </div>
      )}

      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="Scans today" value={(KPIS.scansToday + scansRun).toLocaleString('en-IN')} sub={`+${scansRun} this session`} icon="scan" />
        <KpiCard label="Blocked" value={KPIS.blocked + (alert ? 1 : 0)} sub="incl. honeytokens" icon="x" tone="var(--critical)" />
        <KpiCard label="Minimised & sent" value={KPIS.minimisedAndSent} sub="not blocked" icon="send" tone="var(--accent)" />
        <KpiCard label="Local answers" value={KPIS.localAnswers} sub="stayed on device" icon="cpu" tone="var(--safe)" />
        <KpiCard label="Review rate" value={`${KPIS.reviewRate}%`} sub="target < 10%" icon="eye" tone="var(--review)" />
        <KpiCard label="Honeytoken alerts" value={KPIS.honeytokenAlerts + (alert ? 1 : 0)} sub={alert ? alert.tokenId : 'none today'} icon="alert" tone={alert ? 'var(--critical)' : undefined} highlight={!!alert} />
      </div>

      <div className="grid grid-cols-[1.25fr_1fr_1.35fr] gap-3">
        <Panel>
          <PanelHeader kicker="Events by category" title="What is being protected" right={<SimTag />} />
          <div className="h-[210px] px-2 py-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EVENTS_BY_CATEGORY} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 8 }} barCategoryGap={5}>
                <CartesianGrid {...GRID} horizontal={false} vertical />
                <XAxis type="number" {...AXIS} axisLine={false} />
                <YAxis type="category" dataKey="short" {...AXIS} width={72} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--panel-2)' }} content={<ChartTooltip />} />
                <Bar dataKey="events" name="Events" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={16} label={{ position: 'right', fill: 'var(--ink-3)', fontSize: 10.5 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHeader kicker="Events by AI tool" title="Where data is heading" right={<SimTag />} />
          <div className="h-[210px] px-2 py-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EVENTS_BY_TOOL} margin={{ top: 16, right: 8, bottom: 0, left: -12 }} barCategoryGap="28%">
                <CartesianGrid {...GRID} />
                <XAxis dataKey="tool" {...AXIS} />
                <YAxis {...AXIS} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--panel-2)' }} content={<ChartTooltip />} />
                <Bar dataKey="events" name="Events" fill="var(--ink-2)" radius={[4, 4, 0, 0]} maxBarSize={30} label={{ position: 'top', fill: 'var(--ink-3)', fontSize: 10.5 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHeader kicker="Risk levels this week" title="Flagged requests per day" right={<SimTag />} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pt-2">
            {WEEK_SERIES.map((l) => (
              <span key={l} className="flex items-center gap-1.5 text-[10.5px] text-ink-2">
                <span className="h-0.5 w-3 rounded-full" style={{ background: riskVar(l) }} />
                {l}
              </span>
            ))}
          </div>
          <div className="h-[182px] px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={RISK_WEEK} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="day" {...AXIS} />
                <YAxis {...AXIS} axisLine={false} />
                <Tooltip cursor={{ stroke: 'var(--line-2)' }} content={<ChartTooltip />} />
                {WEEK_SERIES.map((l) => (
                  <Line key={l} type="monotone" dataKey={l} name={l} stroke={riskVar(l)} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)' }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader kicker="Recent events" title="Metadata only: no prompt text, hashed user IDs" right={<SimTag />} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left">
              <tr className="border-b border-line bg-panel-2">
                {['Time', 'Department', 'AI tool', 'Category', 'Risk', 'Action', 'User (hashed)'].map((h) => (
                  <th key={h} className="px-4 py-2 font-normal">
                    <Kicker>{h}</Kicker>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className={`border-b border-line/70 last:border-0 ${i === 0 && alert ? 'rise bg-critical/5' : ''}`}>
                  <td className="num px-4 py-1.5 font-mono text-ink-2">{e.time}</td>
                  <td className="px-4 py-1.5">{e.department}</td>
                  <td className="px-4 py-1.5">{e.tool}</td>
                  <td className="px-4 py-1.5 font-mono text-[10.5px] text-ink-2">{e.category}</td>
                  <td className="px-4 py-1.5">
                    <RiskBadge level={e.risk} size="sm" />
                  </td>
                  <td className="px-4 py-1.5">{e.action}</td>
                  <td className="px-4 py-1.5 font-mono text-[11px] text-ink-3">{e.userHash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
