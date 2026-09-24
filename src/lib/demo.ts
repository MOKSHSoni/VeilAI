// Demo mode: auto-plays the 3-minute demo path (build spec §15) across screens with no typing.

import { useSyncExternalStore } from 'react';

export type DemoStep =
  | { kind: 'scenario'; id: number; label: string }
  | { kind: 'route'; path: string; label: string; dwellMs: number }
  | { kind: 'feedback'; path: string; label: string };

export const DEMO_STEPS: DemoStep[] = [
  { kind: 'scenario', id: 6, label: 'Scenario 6 · SAFE, fast' },
  { kind: 'scenario', id: 1, label: 'Scenario 1 · secret masked' },
  { kind: 'scenario', id: 2, label: 'Scenario 2 · honeytoken blocked' },
  { kind: 'scenario', id: 3, label: 'Scenario 3 · Org DNA, answer locally' },
  { kind: 'scenario', id: 4, label: 'Scenario 4 · minimisation' },
  { kind: 'scenario', id: 5, label: 'Scenario 5 · verification repair' },
  { kind: 'route', path: '/dashboard', label: 'Dashboard · honeytoken alert', dwellMs: 7000 },
  { kind: 'feedback', path: '/feedback', label: 'Feedback · approve Project Atlas' },
  { kind: 'scenario', id: 10, label: 'Scenario 10 · now SAFE' },
  { kind: 'route', path: '/benchmark', label: 'Benchmark · measured data', dwellMs: 12000 },
];

export interface DemoState {
  active: boolean;
  paused: boolean;
  index: number;
}

let state: DemoState = { active: false, paused: false, index: 0 };
const listeners = new Set<() => void>();
const set = (p: Partial<DemoState>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};

export const demo = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  start: () => set({ active: true, paused: false, index: 0 }),
  stop: () => set({ active: false, paused: false, index: 0 }),
  togglePause: () => set({ paused: !state.paused }),
  /** Advance only if `from` is still the current step (guards against double-advance). */
  next(from?: number) {
    if (!state.active) return;
    if (from !== undefined && from !== state.index) return;
    if (state.index >= DEMO_STEPS.length - 1) set({ active: false, index: 0 });
    else set({ index: state.index + 1 });
  },
  prev: () => set({ index: Math.max(0, state.index - 1) }),
};

export function useDemo(): DemoState & { step: DemoStep | null } {
  const s = useSyncExternalStore(demo.subscribe, demo.get);
  return { ...s, step: s.active ? DEMO_STEPS[s.index] : null };
}
