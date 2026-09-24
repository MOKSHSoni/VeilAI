// Styled Recharts tooltip. Text wears ink tokens; the colour swatch carries series identity.

interface Item {
  name?: string | number;
  value?: string | number;
  color?: string;
}

export function ChartTooltip({ active, payload, label, unit = '' }: { active?: boolean; payload?: Item[]; label?: string | number; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-panel px-2.5 py-2 text-[11.5px] shadow-lg">
      {label !== undefined && <div className="mb-1 font-medium text-ink">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-ink-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="num font-mono font-semibold text-ink">
            {p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export const AXIS = { stroke: 'var(--line-2)', tick: { fill: 'var(--ink-3)', fontSize: 11 }, tickLine: false } as const;
export const GRID = { stroke: 'var(--line)', strokeDasharray: '0', vertical: false } as const;
