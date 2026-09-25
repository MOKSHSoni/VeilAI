import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { DemoHud } from './DemoHud';
import { useDemo } from '../lib/demo';

const NAV: { to: string; label: string; icon: IconName; hint: string }[] = [
  { to: '/', label: 'Scan', icon: 'scan', hint: 'Prompt firewall' },
  { to: '/document', label: 'Document Scan', icon: 'doc', hint: 'Page heatmap' },
  { to: '/dashboard', label: 'Admin Dashboard', icon: 'dash', hint: 'Metadata only' },
  { to: '/feedback', label: 'Analyst Feedback', icon: 'feedback', hint: 'Adaptive detection' },
  { to: '/benchmark', label: 'Benchmark', icon: 'bench', hint: 'Measured data' },
];

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M8.5 9.5 16 24l7.5-14.5" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M11 9.5h10" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('veil-theme', dark ? 'dark' : 'light');
    } catch {
      /* storage unavailable: theme simply does not persist */
    }
  }, [dark]);
  return [dark, setDark] as const;
}

export function Layout() {
  const [dark, setDark] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const current = NAV.find((n) => n.to === pathname) ?? NAV[0];

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-full min-h-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <SidebarContent dark={dark} setDark={setDark} />
      </aside>

      {/* Mobile navigation drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="rise absolute inset-y-0 left-0 flex w-[260px] max-w-[85vw] flex-col border-r border-line bg-panel shadow-2xl">
            <SidebarContent dark={dark} setDark={setDark} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-2"
          >
            <Icon name="menu" size={18} />
          </button>
          <BrandMark size={24} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-display text-[14px] font-semibold">VeilAI</div>
            <div className="truncate text-[10.5px] text-ink-3">{current.label}</div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-2"
          >
            <Icon name={dark ? 'moon' : 'sun'} size={16} />
          </button>
        </div>
        <AttestationStrip />
        <main id="main" className="surface-grid min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ dark, setDark }: { dark: boolean; setDark: (f: (d: boolean) => boolean) => void }) {
  return (
    <>
        <div className="flex items-center gap-2.5 px-4 pb-4 pt-4">
          <BrandMark />
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold tracking-tight">VeilAI</div>
            <div className="kicker !text-[9px]">Privacy firewall</div>
          </div>
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                  isActive ? 'bg-panel-2 font-medium text-ink' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute bottom-2 left-0 top-2 w-[2px] rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`} />
                  <Icon name={n.icon} className={isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'} />
                  <span className="flex flex-col leading-tight">
                    <span>{n.label}</span>
                    <span className="text-[10.5px] font-normal text-ink-3">{n.hint}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 p-3">
          <div className="rounded-lg border border-line bg-panel-2 p-3">
            <div className="kicker mb-1.5">Engine</div>
            <div className="flex items-center gap-2 text-[12px] text-ink-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-safe opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-safe" />
              </span>
              Local · offline
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-ink-3">qwen3:4b · Q4_K_M</div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="flex w-full items-center justify-between rounded-md border border-line px-2.5 py-1.5 text-[12px] text-ink-2 hover:bg-panel-2"
            aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
          >
            <span className="flex items-center gap-2">
              <Icon name={dark ? 'moon' : 'sun'} size={14} />
              {dark ? 'Dark' : 'Light'} theme
            </span>
            <span className="font-mono text-[10px] text-ink-3">toggle</span>
          </button>
        </div>
    </>
  );
}

export function AttestationStrip() {
  const demoActive = useDemo().active;
  const items: { icon: IconName; k: string; v: string }[] = [
    { icon: 'cpu', k: 'Analysis', v: 'on device' },
    { icon: 'layers', k: 'Model', v: 'Ollama + Qwen3 4B (simulated)' },
    { icon: 'wifiOff', k: 'Network', v: 'not used' },
  ];
  return (
    <div
      role="status"
      aria-label="Local privacy attestation"
      className="flex h-9 shrink-0 items-center gap-3 overflow-hidden border-b border-line bg-panel px-3 text-[11.5px] lg:gap-5 lg:px-5 lg:text-[12px]"
    >
      <span className="hidden shrink-0 items-center gap-1.5 font-medium text-ink sm:flex">
        <Icon name="shield" size={14} className="text-accent" /> Attestation
      </span>
      <span className="hidden h-3.5 w-px shrink-0 bg-line-2 sm:block" />
      {items.filter((i) => !demoActive || i.k !== 'Model').map((i) => (
        <span key={i.k} className={`shrink-0 items-center gap-1.5 text-ink-2 ${i.k === 'Model' || demoActive ? 'hidden md:flex' : 'flex'}`}>
          <Icon name={i.icon} size={13} className="text-ink-3" />
          <span className="text-ink-3">{i.k}:</span>
          <span className="font-mono text-[11.5px] text-ink">{i.v}</span>
        </span>
      ))}
      <DemoHud />
      {!demoActive && <span className="ml-auto hidden truncate font-mono text-[10.5px] text-ink-3 xl:block">original content never transmitted</span>}
    </div>
  );
}
