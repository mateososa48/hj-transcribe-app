import { create } from 'zustand';

import type { SessionKind } from '@/lib/db';

/**
 * The Diktat page treatment under evaluation: same two-column arrangement,
 * same behaviour, four looks. 'aktuell' is the shipped framed-panel page.
 * Chosen via the floating pill, ?variante= or localStorage; deleted together
 * with the losers once one wins.
 */
export type DiktatVariantId = 'aktuell' | 'blatt' | 'leiste' | 'kontrast';

export const DIKTAT_VARIANT_IDS: DiktatVariantId[] = ['aktuell', 'blatt', 'leiste', 'kontrast'];

const VARIANT_KEY = 'arztbrief-diktat-variante';

function initialVariant(): DiktatVariantId {
  if (typeof window === 'undefined') return 'aktuell';
  const fromUrl = new URLSearchParams(window.location.search).get('variante');
  const stored = window.localStorage.getItem(VARIANT_KEY);
  const candidate = fromUrl ?? stored;
  return (DIKTAT_VARIANT_IDS as string[]).includes(candidate ?? '')
    ? (candidate as DiktatVariantId)
    : 'aktuell';
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
  diktatVariant: DiktatVariantId;
  /** Bumped whenever a session is created/deleted/renamed, so lists refresh. */
  sessionsVersion: number;

  setDiktatVariant: (variant: DiktatVariantId) => void;
  goHome: () => void;
  startRecording: (kind: SessionKind) => void;
  openSession: (sessionId: string) => void;
  openSettings: () => void;
  touchSessions: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: { name: 'start' },
  diktatVariant: initialVariant(),
  sessionsVersion: 0,

  setDiktatVariant: (variant) => {
    try {
      window.localStorage.setItem(VARIANT_KEY, variant);
      const url = new URL(window.location.href);
      url.searchParams.set('variante', variant);
      window.history.replaceState({}, '', url);
    } catch {
      // Private mode — the choice just does not persist.
    }
    set({ diktatVariant: variant });
  },

  goHome: () => set({ view: { name: 'start' } }),
  startRecording: (kind) => set({ view: { name: 'record', kind } }),
  openSession: (sessionId) => set({ view: { name: 'session', sessionId } }),
  openSettings: () => set({ view: { name: 'settings' } }),
  touchSessions: () => set((s) => ({ sessionsVersion: s.sessionsVersion + 1 })),
}));
