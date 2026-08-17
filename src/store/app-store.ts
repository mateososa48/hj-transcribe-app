import { create } from 'zustand';

import type { SessionKind } from '@/lib/db';

/**
 * Where he is in the app. Four screens, one at a time.
 *
 * There is no router and no URL state: this runs on one machine, in one tab,
 * for one person who will never bookmark a screen. A router would only add a
 * way for the back button to strand him mid-recording.
 */
export type View = 'start' | 'aufnahme' | 'ergebnis' | 'einstellungen';

interface AppState {
  view: View;
  /** The recording currently being made or read. */
  sessionId: string | null;
  /** Which feature is in play. Set when a recording starts, kept for the result. */
  kind: SessionKind;

  goHome: () => void;
  startRecording: (kind: SessionKind) => void;
  openResult: (sessionId: string, kind: SessionKind) => void;
  openSettings: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'start',
  sessionId: null,
  kind: 'gespraech',

  goHome: () => set({ view: 'start' }),
  startRecording: (kind) => set({ view: 'aufnahme', kind, sessionId: null }),
  openResult: (sessionId, kind) => set({ view: 'ergebnis', sessionId, kind }),
  openSettings: () => set({ view: 'einstellungen' }),
}));
