import { create } from 'zustand';

/**
 * App-level navigation state, shared by all three layout shells.
 *
 * Lives outside the layouts so switching layout never loses the user's place —
 * which matters while we are comparing them side by side.
 */

export type View = 'aufnahme' | 'brief' | 'einstellungen';

/**
 * The three layouts under evaluation. Same design language throughout — same
 * tokens, type scale, components and German. They differ only in how the work
 * is arranged on screen.
 */
export type LayoutId = 'fokus' | 'werkbank' | 'split';

export const LAYOUTS: Array<{ id: LayoutId; label: string; blurb: string }> = [
  {
    id: 'fokus',
    label: 'Fokus',
    blurb: 'Eine Aufgabe pro Bildschirm, mittig, größtmögliche Schaltflächen.',
  },
  {
    id: 'werkbank',
    label: 'Werkbank',
    blurb: 'Seitenleiste mit allen Briefen und ihrem Stand, Arbeitsfläche rechts.',
  },
  {
    id: 'split',
    label: 'Gegenüberstellung',
    blurb: 'Diktat und Entwurf nebeneinander — zum direkten Vergleichen beim Prüfen.',
  },
];

const LAYOUT_KEY = 'arztbrief-layout';

function initialLayout(): LayoutId {
  if (typeof window === 'undefined') return 'fokus';
  const fromUrl = new URLSearchParams(window.location.search).get('layout');
  const stored = window.localStorage.getItem(LAYOUT_KEY);
  const candidate = fromUrl ?? stored;
  return LAYOUTS.some((l) => l.id === candidate) ? (candidate as LayoutId) : 'fokus';
}

interface AppState {
  view: View;
  sessionId: string | null;
  layout: LayoutId;
  setView: (view: View) => void;
  setSessionId: (id: string | null) => void;
  setLayout: (layout: LayoutId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'aufnahme',
  sessionId: null,
  layout: initialLayout(),

  setView: (view) => set({ view }),
  setSessionId: (sessionId) => set({ sessionId }),
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
}));
