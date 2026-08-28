import { create } from 'zustand';

import type { SessionKind } from '@/lib/db';

/**
 * Where he is in the app.
 *
 * No router and no URL state: one machine, one tab, one person who will never
 * bookmark a screen. A router would only add a way for the back button to
 * strand him mid-recording.
 */
export type View =
  | { name: 'start' }
  | { name: 'record'; kind: SessionKind }
  | { name: 'session'; sessionId: string }
  | { name: 'document'; documentId: string }
  | { name: 'settings' };

interface AppState {
  view: View;
  /** Bumped whenever a session is created/deleted/renamed, so lists refresh. */
  sessionsVersion: number;

  goHome: () => void;
  startRecording: (kind: SessionKind) => void;
  openSession: (sessionId: string) => void;
  openDocument: (documentId: string) => void;
  openSettings: () => void;
  touchSessions: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: { name: 'start' },
  sessionsVersion: 0,

  goHome: () => set({ view: { name: 'start' } }),
  startRecording: (kind) => set({ view: { name: 'record', kind } }),
  openSession: (sessionId) => set({ view: { name: 'session', sessionId } }),
  openDocument: (documentId) => set({ view: { name: 'document', documentId } }),
  openSettings: () => set({ view: { name: 'settings' } }),
  touchSessions: () => set((s) => ({ sessionsVersion: s.sessionsVersion + 1 })),
}));
