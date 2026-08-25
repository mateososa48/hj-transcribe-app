import type { DiktatDesignId } from '@/store/app-store';

/**
 * Names and one-line bets for the Diktat layout experiments. Deliberately free
 * of component imports: the switcher and the node test suite read this without
 * dragging React or the browser into scope. Every entry is the SAME design
 * language — what varies is only how the parts are arranged.
 */
export const DIKTAT_DESIGN_META: Record<DiktatDesignId, { label: string; blurb: string }> = {
  standard: { label: 'Standard', blurb: 'Wie bisher: Text oben, Aufnahme darunter.' },
  spalten: { label: 'Spalten', blurb: 'Text links, Aufnahme rechts — durch eine Linie getrennt.' },
  reiter: { label: 'Reiter', blurb: 'Zwei Tabs: Text und Aufnahme, wie beim Termin.' },
  mappen: { label: 'Mappen', blurb: 'Mappen mit Reitern — die Aufnahme als Anlage dahinter.' },
  abschnitte: { label: 'Abschnitte', blurb: 'Ein Rahmen, innen durch Linien in Abschnitte geteilt.' },
  karten: { label: 'Karten', blurb: 'Jeder Teil als eigene Karte: Text links, Ton und Mitlesetext rechts.' },
  tonzuerst: { label: 'Ton zuerst', blurb: 'Aufnahme und Mitlesetext oben, der fertige Text darunter.' },
  klappen: { label: 'Aufklappbar', blurb: 'Nur der Text — die Aufnahme klappt bei Bedarf darunter auf.' },
  pruefen: { label: 'Prüfansicht', blurb: 'Text und Mitlesetext gleich breit nebeneinander zum Vergleichen.' },
};
