import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_STEPS, demo, useDemo } from '../lib/demo';
import { Icon } from './Icon';

/** Navigates between screens for demo mode and shows transport controls. */
export function DemoHud() {
  const d = useDemo();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const step = d.step;

  const target = step ? (step.kind === 'scenario' ? '/' : step.path) : null;
  useEffect(() => {
    if (target && pathname !== target) navigate(target);
  }, [target, pathname, navigate]);

  useEffect(() => {
    if (!step || step.kind !== 'route' || d.paused) return;
    const t = setTimeout(() => demo.next(d.index), step.dwellMs);
    return () => clearTimeout(t);
  }, [step, d.paused, d.index]);

  if (!d.active || !step) return null;
  return (
    <div className="ml-auto flex shrink-0">
      <div
        role="region"
        aria-label="Demo mode controls"
        className="rise flex h-7 items-center gap-3 rounded-full border border-white/10 bg-[#111217] pl-3 pr-1 text-[12px] text-white"
      >
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-wider text-[#8fa0ff]">
          <span className={`h-1.5 w-1.5 rounded-full bg-[#8fa0ff] ${d.paused ? '' : 'animate-pulse'}`} />
          DEMO {d.index + 1}/{DEMO_STEPS.length}
        </span>
        <span className="max-w-[240px] truncate">{step.label}</span>
        <div className="flex items-center gap-0.5">
          <HudBtn label="Previous step" onClick={demo.prev}>
            <Icon name="arrow" size={13} className="rotate-180" />
          </HudBtn>
          <HudBtn label={d.paused ? 'Resume' : 'Pause'} onClick={demo.togglePause}>
            <Icon name={d.paused ? 'play' : 'pause'} size={13} />
          </HudBtn>
          <HudBtn label="Next step" onClick={() => demo.next()}>
            <Icon name="arrow" size={13} />
          </HudBtn>
          <HudBtn label="Stop demo" onClick={demo.stop}>
            <Icon name="x" size={13} />
          </HudBtn>
        </div>
      </div>
    </div>
  );
}

function HudBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}
