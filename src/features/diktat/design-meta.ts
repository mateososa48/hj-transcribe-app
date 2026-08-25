import type { DiktatDesignId } from '@/store/app-store';

/**
 * Names and one-line bets for the Diktat design experiments. Deliberately free
 * of component imports: the switcher and the node test suite read this without
 * dragging React, CSS modules or the browser into scope.
 */
export const DIKTAT_DESIGN_META: Record<DiktatDesignId, { label: string; blurb: string }> = {
  standard: { label: 'Standard', blurb: 'Die ausgelieferte Gestaltung — weiche Karten, ruhige Fläche.' },
  karteikarte: { label: 'Karteikarte', blurb: 'Harte 2-px-Rahmen, eckig, Abschnittsbänder wie auf einer Patientenkarte.' },
  formular: { label: 'Befundbogen', blurb: 'Ein Bogen aus beschrifteten Zeilen — alles in einem gerahmten Formular.' },
  fenster: { label: 'Fensterrahmen', blurb: 'Umrandete Felder mit Beschriftung im Rahmen, nebeneinander gesetzt.' },
  studio: { label: 'Studio', blurb: 'Dunkles Aufnahmepult, der Text liegt als helles Blatt darin.' },
  manuskript: { label: 'Manuskript', blurb: 'Serifenschrift, Linien statt Kästen — der Text als Schriftstück.' },
  terminal: { label: 'Terminal', blurb: 'Monospace, dünne Linien, Protokollzeile — dicht und nüchtern.' },
  akte: { label: 'Aktenmappe', blurb: 'Mappen mit Reitern: die Beurteilung vorn, die Aufnahme als Anlage.' },
  fokus: { label: 'Fokus', blurb: 'Keine Rahmen, viel Ruhe — nur der Text und eine große Uhr.' },
  plakat: { label: 'Plakat', blurb: 'Schwarze Balken, dicke Linien, große Ziffern — maximaler Kontrast.' },
  glas: { label: 'Glas', blurb: 'Milchglas-Ebenen mit weichem Licht, stark gerundet und glänzend.' },
};
