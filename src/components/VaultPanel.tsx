import type { VaultEntry } from '../lib/masking';
import { Icon } from './Icon';
import { Kicker } from './ui';

export function VaultPanel({ vault, compact = false }: { vault: VaultEntry[]; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon name="lock" size={13} className="text-accent" />
          <span className="text-[12px] font-semibold">Local vault</span>
          <span className="font-mono text-[10.5px] text-ink-3">{vault.length} entries</span>
        </div>
        <span className="rounded bg-accent-soft px-1.5 py-px font-mono text-[10px] text-accent">Stays on this device</span>
      </div>
      {vault.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-ink-3">Empty: nothing needed pseudonymising.</div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left">
              <th className="px-3 pb-1 pt-2 font-normal">
                <Kicker>Placeholder</Kicker>
              </th>
              <th className="px-3 pb-1 pt-2 font-normal">
                <Kicker>Original</Kicker>
              </th>
              {!compact && (
                <th className="px-3 pb-1 pt-2 font-normal">
                  <Kicker>Type</Kicker>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {vault.map((v) => (
              <tr key={v.placeholder} className="border-t border-line/70 align-top">
                <td className="whitespace-nowrap px-3 py-1.5">
                  <span className="ph-chip">{v.placeholder}</span>
                </td>
                <td className="px-3 py-1.5">
                  <span className={`break-all font-mono text-[11.5px] ${v.secret ? 'text-critical' : ''}`}>{v.secret ? mask(v.original) : v.original}</span>
                  {v.aliases.length > 0 && <div className="mt-0.5 text-[10.5px] text-ink-3">+ alias {v.aliases.map((a) => `"${a}"`).join(', ')}</div>}
                  {v.secret && <div className="mt-0.5 text-[10.5px] text-ink-3">secret: never restored into prompts</div>}
                </td>
                {!compact && <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[10.5px] text-ink-3">{v.entityType}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const mask = (s: string) => (s.length <= 6 ? '••••••' : `${s.slice(0, 4)}${'•'.repeat(Math.min(12, s.length - 6))}${s.slice(-2)}`);
