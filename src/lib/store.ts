// In-memory app state (allowlist, alerts, feedback progress). Nothing is persisted or sent anywhere.

import { useSyncExternalStore } from 'react';

export type FeedbackStage = 'OPEN' | 'CONFIRMED' | 'FALSE_NEGATIVE' | 'PROPOSED' | 'GATE_PASSED' | 'AWAITING_APPROVAL' | 'APPLIED';

export interface HoneytokenAlert {
  tokenId: string;
  source: string;
  at: string;
}

export interface AppState {
  allowlist: string[];
  allowlistVersion: number;
  honeytokenAlert: HoneytokenAlert | null;
  feedback: Record<string, FeedbackStage>;
  scansRun: number;
}

const initial = (): AppState => ({
  allowlist: [],
  allowlistVersion: 1,
  honeytokenAlert: null,
  feedback: {},
  scansRun: 0,
});

let state: AppState = initial();
const listeners = new Set<() => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  addToAllowlist(term: string) {
    if (state.allowlist.some((t) => t.toLowerCase() === term.toLowerCase())) return;
    set({ allowlist: [...state.allowlist, term], allowlistVersion: state.allowlistVersion + 1 });
  },
  raiseHoneytokenAlert(tokenId: string, source: string) {
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    set({ honeytokenAlert: { tokenId, source, at } });
  },
  setFeedback(id: string, stage: FeedbackStage) {
    set({ feedback: { ...state.feedback, [id]: stage } });
  },
  recordScan() {
    set({ scansRun: state.scansRun + 1 });
  },
  reset() {
    set(initial());
  },
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
