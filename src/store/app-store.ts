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

/**
 * The Diktat design experiments — the second, independent axis. Where a layout
 * rearranges the app shell for BOTH features, a Diktat design changes the
 * visual language (borders, corners, sectioning, type) of the Diktat screens
 * only: the Diktat recorder and the finished Beurteilung page. The Termin
 * feature never sees any of this — it renders the shipped design regardless.
 */
export type DiktatDesignId =
  | 'standard'
  | 'karteikarte'
  | 'formular'
  | 'fenster'
  | 'studio'
  | 'manuskript'
  | 'terminal'
  | 'akte'
  | 'fokus'
  | 'plakat'
  | 'glas';

export const DIKTAT_DESIGN_IDS: DiktatDesignId[] = [
  'standard',
  'karteikarte',
  'formular',
  'fenster',
  'studio',
  'manuskript',
  'terminal',
  'akte',
  'fokus',
  'plakat',
  'glas',
];

const LAYOUT_KEY = 'arztbrief-layout';
const DESIGN_KEY = 'arztbrief-diktat-design';

/** URL param wins over the stored choice, so links can pin an experiment. */
function initialChoice<T extends string>(param: string, key: string, ids: readonly T[]): T {
  if (typeof window === 'undefined') return ids[0] as T;
  const fromUrl = new URLSearchParams(window.location.search).get(param);
  const stored = window.localStorage.getItem(key);
  const candidate = fromUrl ?? stored;
  return (ids as readonly string[]).includes(candidate ?? '') ? (candidate as T) : (ids[0] as T);
}

function persistChoice(param: string, key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
    const url = new URL(window.location.href);
    url.searchParams.set(param, value);
    window.history.replaceState({}, '', url);
  } catch {
    // Private mode — the choice just does not persist.
  }
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
  diktatDesign: DiktatDesignId;
  /** Bumped whenever a session is created/deleted/renamed, so lists refresh. */
  sessionsVersion: number;

  setLayout: (layout: LayoutId) => void;
  setDiktatDesign: (design: DiktatDesignId) => void;
  goHome: () => void;
  startRecording: (kind: SessionKind) => void;
  openSession: (sessionId: string) => void;
  openSettings: () => void;
  touchSessions: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: { name: 'start' },
  layout: initialChoice('layout', LAYOUT_KEY, LAYOUT_IDS),
  diktatDesign: initialChoice('design', DESIGN_KEY, DIKTAT_DESIGN_IDS),
  sessionsVersion: 0,

  setLayout: (layout) => {
    persistChoice('layout', LAYOUT_KEY, layout);
    set({ layout });
  },

  setDiktatDesign: (design) => {
    persistChoice('design', DESIGN_KEY, design);
    set({ diktatDesign: design });
  },

  goHome: () => set({ view: { name: 'start' } }),
  startRecording: (kind) => set({ view: { name: 'record', kind } }),
  openSession: (sessionId) => set({ view: { name: 'session', sessionId } }),
  openSettings: () => set({ view: { name: 'settings' } }),
  touchSessions: () => set((s) => ({ sessionsVersion: s.sessionsVersion + 1 })),
}));
