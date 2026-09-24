import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Kicker, SimTag } from './ui';

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: IconName;
  /** CSS colour for the value; defaults to ink. */
  tone?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`panel relative overflow-hidden p-3 ${highlight ? 'ring-2 ring-critical/60' : ''}`}>
      <div className="flex items-center justify-between">
        <Kicker>{label}</Kicker>
        <Icon name={icon} size={14} className="text-ink-3" />
      </div>
      <div className="num mt-1 font-display text-[26px] font-semibold leading-tight tracking-tight" style={{ color: tone }}>
        {value}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-3">
        <span className="truncate">{sub}</span>
        <SimTag />
      </div>
    </div>
  );
}
