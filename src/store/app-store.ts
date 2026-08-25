import { create } from 'zustand';

import type { SessionKind } from '@/lib/db';

/**
 * The Diktat design experiments. Where the app shell is settled (the sidebar
 * layout won its evaluation), the finished-Diktat page is still being chosen:
 * a design changes the visual language (borders, corners, sectioning, type)
 * of the Diktat RESULT page only. The recorder and the Termin feature always
 * render the shipped design. Chosen via the floating switcher, ?design= or
 * localStorage, so candidates can be compared on the same data.
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

const DESIGN_KEY = 'arztbrief-diktat-design';

/** URL param wins over the stored choice, so links can pin an experiment. */
function initialDesign(): DiktatDesignId {
  if (typeof window === 'undefined') return 'standard';
  const fromUrl = new URLSearchParams(window.location.search).get('design');
  const stored = window.localStorage.getItem(DESIGN_KEY);
  const candidate = fromUrl ?? stored;
  return (DIKTAT_DESIGN_IDS as string[]).includes(candidate ?? '')
    ? (candidate as DiktatDesignId)
    : 'standard';
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
  diktatDesign: DiktatDesignId;
  /** Bumped whenever a session is created/deleted/renamed, so lists refresh. */
  sessionsVersion: number;

  setDiktatDesign: (design: DiktatDesignId) => void;
  goHome: () => void;
  startRecording: (kind: SessionKind) => void;
  openSession: (sessionId: string) => void;
  openSettings: () => void;
  touchSessions: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: { name: 'start' },
  diktatDesign: initialDesign(),
  sessionsVersion: 0,

  setDiktatDesign: (design) => {
    try {
      window.localStorage.setItem(DESIGN_KEY, design);
      const url = new URL(window.location.href);
      url.searchParams.set('design', design);
      window.history.replaceState({}, '', url);
    } catch {
      // Private mode — the choice just does not persist.
    }
    set({ diktatDesign: design });
  },

  goHome: () => set({ view: { name: 'start' } }),
  startRecording: (kind) => set({ view: { name: 'record', kind } }),
  openSession: (sessionId) => set({ view: { name: 'session', sessionId } }),
  openSettings: () => set({ view: { name: 'settings' } }),
  touchSessions: () => set((s) => ({ sessionsVersion: s.sessionsVersion + 1 })),
}));
