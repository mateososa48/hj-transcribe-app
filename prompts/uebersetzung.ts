import { CORE_RULES, PROMPT_VERSION } from './rules.ts';

/**
 * Translating a finished Arztbrief.
 *
 * The letter is translated SEGMENT BY SEGMENT, not rewritten: the editor hands
 * over every run of text in the document in reading order, and the model hands
 * back the same list in the same order. The document's structure — headings,
 * lists, the literal tabs the Medikation columns stand on — never reaches the
 * model at all, so it cannot be lost.
 *
 * That shape also decides the rules below. A segment is not a text to be
 * improved: it is one run of words whose meaning must survive into another
 * language with every number, unit and drug name intact. Nothing is added,
 * nothing is summarised, and a segment with nothing to translate comes back
 * exactly as it went in.
 */

export const UEB_TAG = 'ueb';

/** The languages the letter can be turned into. */
export const TRANSLATION_LANGUAGES = [
  { code: 'de', label: 'Deutsch', name: 'German', endonym: 'Deutsch' },
  { code: 'en', label: 'Englisch', name: 'English', endonym: 'English' },
  { code: 'fr', label: 'Französisch', name: 'French', endonym: 'Français' },
  { code: 'it', label: 'Italienisch', name: 'Italian', endonym: 'Italiano' },
  { code: 'es', label: 'Spanisch', name: 'Spanish', endonym: 'Español' },
  { code: 'tr', label: 'Türkisch', name: 'Turkish', endonym: 'Türkçe' },
] as const;

export type TranslationLanguageCode = (typeof TRANSLATION_LANGUAGES)[number]['code'];
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export function findLanguage(code: string): TranslationLanguage | undefined {
  return TRANSLATION_LANGUAGES.find((l) => l.code === code);
}

/** Stable half — rules and contract. Carries the cache breakpoint. */
export function buildUebersetzungSystemPrompt(language: TranslationLanguage): string {
  return `Sie übersetzen den Arztbrief eines deutschen Kardiologen ins ${language.label === 'Deutsch' ? 'Deutsche' : `${language.label}e`}.

Der Brief ist bereits geschrieben und vom Arzt freigegeben. Ihre Aufgabe ist
allein die Übersetzung — nicht das Umschreiben, nicht das Kürzen, nicht das
Verbessern. Der übersetzte Brief muss dieselbe Aussage haben wie das Original,
Satz für Satz.

Sie erhalten den Brief in nummerierten Segmenten. Ein Segment ist ein
zusammenhängender Textlauf aus dem Dokument: eine Überschrift, ein Absatz,
ein Aufzählungspunkt oder eine Zeile der Medikationstabelle. Die Struktur des
Dokuments liegt außerhalb Ihrer Antwort; Sie sehen und ändern sie nicht.

${CORE_RULES}

ÜBERSETZUNGSREGELN

Unverändert übernehmen — Zeichen für Zeichen:
- Alle Zahlen, Messwerte und Einheiten: 145/90 mmHg, LVEF 58 %, 4,7 cm,
  72/min. Auch das Dezimalkomma bleibt, wo die Zielsprache es kennt; im
  Englischen wird aus 2,5 mg korrekt 2.5 mg.
- Alle Datums- und Zeitangaben in der im Zielland üblichen Schreibweise,
  ohne den Tag oder den Monat zu verändern (10/25 bleibt 10/25).
- Wirkstoffnamen und Präparatenamen: ASS, Clopidogrel, Bisoprolol, Sevikar,
  Rosuvastatin. Ein Wirkstoff heißt in jeder Sprache gleich. Wo das Englische
  einen anderen INN führt, verwenden Sie den dortigen: aus ASS wird Aspirin.
  Die Groß- und Kleinschreibung des Originals bleibt: steht der Wirkstoff am
  Zeilenanfang groß, steht er auch übersetzt groß.
- Einnahmeschemata wie 1-0-0 oder 0-0-1.
- Tabulatorzeichen und Leerzeichenfolgen: sie tragen die Spalten der
  Medikationstabelle. Was zwischen zwei Wörtern steht, bleibt stehen.
- Eigennamen von Personen, Praxen und Straßen. Herr Vollmer bleibt
  Herr Vollmer, die Rheinallee bleibt die Rheinallee.
- Markierungen in eckigen Klammern, etwa [FEHLT: Dosierung]. Sie zeigen dem
  Arzt eine Lücke; nur das Wort darin wird übersetzt, die Klammern und das
  Format bleiben.

Fachsprache:
- Übersetzen Sie in die Fachsprache der Kardiologie des Ziellandes, nicht
  wörtlich. Aus "Zusammenfassende Beurteilung" wird im Englischen "Summary
  and assessment", nicht "Summarising evaluation".
- Anerkannte Abkürzungen werden zur dortigen Abkürzung: EKG wird ECG, KHK
  wird CAD, RIVA wird LAD. Ist eine Abkürzung international gleich
  (NT-proBNP, PCI, LVEF), bleibt sie.
- Anreden und Schlussformeln werden zur dortigen Form, nicht Wort für Wort.

Verboten:
- Inhalte hinzufügen, weglassen, zusammenfassen oder umstellen.
- Aus einem Satz zwei machen oder aus zwei einen.
- Erklärungen, Anmerkungen oder Hinweise an den Arzt einfügen.
- Eine Diagnose, eine Dosis oder einen Wert ergänzen, der im Original nicht
  steht.

Enthält ein Segment nichts zu Übersetzendes — eine reine Zahl, ein Name, eine
Medikationszeile ohne Wörter — geben Sie es unverändert zurück.

AUSGABEFORMAT
Antworten Sie ausschließlich mit einem Block pro Segment, in der Reihenfolge
der Eingabe, ohne Text davor oder danach. Die Nummer ist die des Segments:

<${UEB_TAG} i="1">Übersetzung des ersten Segments</${UEB_TAG}>
<${UEB_TAG} i="2">Übersetzung des zweiten Segments</${UEB_TAG}>

Geben Sie jedes Segment genau einmal aus. Ein Segment darf leer sein, wenn es
im Original leer war.`;
}

/** Volatile half — this letter. Never cached. */
export function buildUebersetzungUserPrompt(segments: string[]): string {
  const body = segments
    .map((text, i) => `<segment i="${i + 1}">${text}</segment>`)
    .join('\n');

  return `ARZTBRIEF, ${segments.length} Segmente:

${body}

Übersetzen Sie alle ${segments.length} Segmente.`;
}

export const UEBERSETZUNG_PROMPT_VERSION = PROMPT_VERSION;

/**
 * Pull the translated segments out of the response, by index.
 *
 * Indexed rather than positional on purpose: a model that drops or reorders a
 * block must not shift every following line of the letter by one. Anything
 * missing comes back as null, and the caller keeps the German for that run —
 * a letter with one untranslated line is repairable; a letter whose medication
 * rows have slid up by one is a hazard.
 */
export function parseUebersetzung(
  raw: string,
  expected: number,
): { segments: (string | null)[]; wellFormed: boolean } {
  const segments: (string | null)[] = new Array(expected).fill(null);
  const pattern = new RegExp(`<${UEB_TAG}\\s+i="(\\d+)"\\s*>([\\s\\S]*?)</${UEB_TAG}>`, 'gi');

  let found = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = Number(match[1]) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= expected) continue;
    if (segments[index] !== null) continue;
    segments[index] = match[2] ?? '';
    found++;
  }

  return { segments, wellFormed: found === expected };
}
