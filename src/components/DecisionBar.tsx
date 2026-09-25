import type { Decision, RiskLevel } from '../data/types';
import { Icon, type IconName } from './Icon';

export const DECISION_META: Record<Decision, { label: string; icon: IconName; hint: string }> = {
  SEND_SANITISED: { label: 'Send sanitised', icon: 'send', hint: 'Send only the verified, privacy-preserving version' },
  ANSWER_LOCALLY: { label: 'Answer locally', icon: 'cpu', hint: 'On-device Qwen answers; nothing leaves the device' },
  EDIT: { label: 'Edit', icon: 'edit', hint: 'Edit the sanitised text; it is re-verified before sending' },
  OVERRIDE: { label: 'Override with justification', icon: 'flag', hint: 'Send the original with a logged, written justification' },
  BLOCK: { label: 'Block', icon: 'x', hint: 'Do not send anything' },
};

const ORDER: Decision[] = ['SEND_SANITISED', 'ANSWER_LOCALLY', 'EDIT', 'OVERRIDE', 'BLOCK'];

export function DecisionBar({
  enabled,
  recommended,
  chosen,
  onChoose,
  risk,
  blocked,
  nothingMasked,
}: {
  enabled: Decision[];
  recommended: Decision;
  chosen: Decision | null;
  onChoose: (d: Decision) => void;
  risk: RiskLevel;
  blocked?: boolean;
  nothingMasked?: boolean;
}) {
  const disabledReason = (d: Decision) => {
    if (enabled.includes(d)) return '';
    if (blocked) return 'Honeytoken incident: only Block is available';
    if (d === 'OVERRIDE' && risk === 'CRITICAL') return 'Override is never available for CRITICAL';
    return 'Not allowed by policy for this request';
  };
  return (
    <div role="group" aria-label="Decision" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
      {ORDER.map((d) => {
        const meta = DECISION_META[d];
        const on = enabled.includes(d);
        const rec = d === recommended;
        const sel = chosen === d;
        const label = d === 'SEND_SANITISED' && nothingMasked ? 'Send (unchanged)' : meta.label;
        return (
          <button
            key={d}
            type="button"
            disabled={!on}
            onClick={() => onChoose(d)}
            title={on ? meta.hint : disabledReason(d)}
            aria-pressed={sel}
            className={`relative flex min-h-[62px] flex-col items-start justify-between rounded-lg border px-2.5 py-2 text-left transition disabled:cursor-not-allowed ${
              sel
                ? d === 'BLOCK'
                  ? 'border-critical bg-critical text-white'
                  : 'border-accent bg-accent text-accent-ink'
                : rec && on
                  ? 'border-accent bg-accent-soft text-ink hover:brightness-[0.98]'
                  : on
                    ? 'border-line-2 bg-panel text-ink hover:bg-panel-2'
                    : 'border-dashed border-line bg-transparent text-ink-3 opacity-60'
            }`}
          >
            <span className="flex w-full items-center justify-between">
              <Icon name={on ? meta.icon : 'lock'} size={14} />
              {rec && on && !sel && <span className="rounded bg-accent px-1 font-mono text-[8.5px] font-semibold tracking-wider text-accent-ink">DEFAULT</span>}
            </span>
            <span className="text-[11.5px] font-medium leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
