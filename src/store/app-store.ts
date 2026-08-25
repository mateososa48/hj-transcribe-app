import { create } from 'zustand';

import type { SessionKind } from '@/lib/db';

/**
 * The layout experiments. 'standard' is what shipped; the others are the six
 * alternatives under evaluation — same design language, same screens, same
 * behaviour, different structure. Chosen via the floating switcher, ?layout=
 * or localStorage, exactly so they can be compared on the same data.
 */
export type LayoutId =
  | 'standard'
  | 'leiste'
  | 'posteingang'
  | 'galerie'
  | 'blatt'
  | 'vergleich'
  | 'protokoll';

export const LAYOUT_IDS: LayoutId[] = [
  'standard',
  'leiste',
  'posteingang',
  'galerie',
  'blatt',
  'vergleich',
  'protokoll',
];

const LAYOUT_KEY = 'arztbrief-layout';

function initialLayout(): LayoutId {
  if (typeof window === 'undefined') return 'standard';
  const fromUrl = new URLSearchParams(window.location.search).get('layout');
  const stored = window.localStorage.getItem(LAYOUT_KEY);
  const candidate = fromUrl ?? stored;
  return (LAYOUT_IDS as string[]).includes(candidate ?? '') ? (candidate as LayoutId) : 'standard';
}

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
  | { name: 'settings' };

interface AppState {
  view: View;
  layout: LayoutId;
  /** Bumped whenever a session is created/deleted/renamed, so lists refresh. */
  sessionsVersion: number;

  setLayout: (layout: LayoutId) => void;
  goHome: () => void;
  startRecording: (kind: SessionKind) => void;
  openSession: (sessionId: string) => void;
  openSettings: () => void;
  touchSessions: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: { name: 'start' },
  layout: initialLayout(),
  sessionsVersion: 0,

  setLayout: (layout) => {
    try {
      window.localStorage.setItem(LAYOUT_KEY, layout);
      const url = new URL(window.location.href);
      url.searchParams.set('layout', layout);
      window.history.replaceState({}, '', url);
    } catch {
      // Private mode — the choice just does not persist.
    }
    set({ layout });
  },

  goHome: () => set({ view: { name: 'start' } }),
  startRecording: (kind) => set({ view: { name: 'record', kind } }),
  openSession: (sessionId) => set({ view: { name: 'session', sessionId } }),
  openSettings: () => set({ view: { name: 'settings' } }),
  touchSessions: () => set((s) => ({ sessionsVersion: s.sessionsVersion + 1 })),
}));
