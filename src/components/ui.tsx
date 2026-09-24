import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Category, LayerStatus, RiskLevel } from '../data/types';

export const riskVar = (l: RiskLevel) => `var(--${l.toLowerCase()})`;

export const tint = (color: string, pct = 12) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;

export function SimTag({ label = 'SIMULATED', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`sim-tag ${className}`} title="Hardcoded demo value: no real model ran">
      {label}
    </span>
  );
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`kicker ${className}`}>{children}</div>;
}

export function Panel({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'aside' }) {
  return <As className={`panel ${className}`}>{children}</As>;
}

export function PanelHeader({ kicker, title, right }: { kicker?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        {kicker && <Kicker className="mb-0.5">{kicker}</Kicker>}
        <h2 className="truncate text-[14px] font-semibold tracking-tight">{title}</h2>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function CategoryChip({ c, primary }: { c: Category; primary?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] tracking-wide ${
        primary ? 'border-ink/25 bg-ink text-bg' : 'border-line-2 text-ink-2'
      }`}
    >
      {c}
    </span>
  );
}

export function Meter({ value, color = 'var(--accent)', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-sunken ${className}`} role="presentation">
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

const STATUS_STYLE: Record<LayerStatus, { color: string; label: string }> = {
  CLEAR: { color: 'var(--safe)', label: 'CLEAR' },
  FLAGGED: { color: 'var(--critical)', label: 'FLAGGED' },
  SKIPPED: { color: 'var(--ink-3)', label: 'SKIPPED' },
};

export function StatusPill({ status }: { status: LayerStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-px font-mono text-[10px] font-medium tracking-wider ${status === 'SKIPPED' ? 'border border-dashed border-line-2' : ''}`}
      style={{ color: s.color, background: status === 'SKIPPED' ? 'transparent' : tint(s.color, 13) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Btn({ variant = 'secondary', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-accent-ink hover:brightness-110 border border-transparent',
    secondary: 'border border-line-2 bg-panel text-ink hover:bg-panel-2',
    ghost: 'border border-transparent text-ink-2 hover:bg-panel-2 hover:text-ink',
    danger: 'border border-transparent bg-critical text-white hover:brightness-110',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${v[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="min-w-0">
      <Kicker>{label}</Kicker>
      <div className="num font-display text-[26px] font-semibold leading-tight tracking-tight" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

export const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`);
export const pct = (v: number) => `${Math.round(v * 100)}%`;
