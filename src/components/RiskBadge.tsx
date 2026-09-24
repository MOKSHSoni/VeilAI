import type { RiskLevel } from '../data/types';
import { riskVar, tint } from './ui';

const GLYPH: Record<RiskLevel, string> = {
  SAFE: '●',
  LOW: '◆',
  MEDIUM: '▲',
  HIGH: '▲',
  CRITICAL: '■',
  REVIEW: '?',
};

export function RiskBadge({ level, size = 'md', className = '' }: { level: RiskLevel; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const c = riskVar(level);
  const sz = {
    sm: 'text-[10px] px-1.5 py-px gap-1',
    md: 'text-[11px] px-2 py-0.5 gap-1.5',
    lg: 'text-[13px] px-2.5 py-1 gap-2',
  }[size];
  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono font-semibold tracking-wider ${sz} ${className}`}
      style={{ color: c, background: tint(c, 11), borderColor: tint(c, 35) }}
      aria-label={`Risk level ${level}`}
    >
      <span aria-hidden="true" className="text-[0.8em] leading-none">
        {GLYPH[level]}
      </span>
      {level}
    </span>
  );
}
