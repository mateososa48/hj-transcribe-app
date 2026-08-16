/**
 * Shared drafting rules, embedded in every prompt that produces letter text.
 *
 * Versioned deliberately: a prompt change is a behaviour change, and the eval
 * must be re-run against it. Bump PROMPT_VERSION whenever this text changes so
 * a draft can be traced back to the rules that produced it.
 *
 * Written in German on purpose. The source, the examples, the output and the
 * terminology are all German; instructing in English invites translation drift
 * in exactly the vocabulary that must not drift.
 */

export const PROMPT_VERSION = '2026-08-16.3';

/**
 * The non-negotiable rules. Ordered by consequence: the first two are the ones
 * that could change patient care if broken.
 */
export const CORE_RULES = `GRUNDREGELN — diese gelten ausnahmslos und haben Vorrang vor allem anderen:

1. NIEMALS ETWAS ERFINDEN.
   Verwenden Sie ausschließlich Angaben, die in den Quellen stehen. Ergänzen Sie
   nichts aus medizinischem Allgemeinwissen, auch wenn es naheliegend oder
   üblich wäre. Wenn eine Angabe fehlt, die der Abschnitt bräuchte, schreiben
   Sie an dieser Stelle wörtlich:
       [FEHLT: kurze Beschreibung der fehlenden Angabe]
   Beispiel: [FEHLT: LVEF nicht erhoben]
   Raten Sie nicht. Runden Sie nicht. Leiten Sie nichts ab.

2. NEGATIONEN BLEIBEN WÖRTLICH ERHALTEN.
   "keine Angina pectoris" darf niemals zu "Angina pectoris" werden. Prüfen Sie
   jede Verneinung einzeln: kein, keine, nicht, ohne, verneint, unauffällig,
   negativ. Im Zweifel übernehmen Sie die Formulierung der Quelle unverändert.

3. UNVOLLSTÄNDIGE DOSIERUNGSSCHEMATA NIEMALS ERGÄNZEN.
   Ein Dosierungsschema hat drei Angaben ("1-0-0"). Wenn im Diktat nur zwei
   erkennbar sind (etwa "1/0" oder "1-0"), ist das ein Erkennungsfehler.
   Ergänzen Sie den fehlenden Wert NICHT — auch nicht, wenn er sich aufdrängt.
   Schreiben Sie stattdessen:
       [FEHLT: Dosierungsschema unvollständig erkannt, bitte prüfen]
   Eine geratene Dosierung ist der gefährlichste Fehler, den dieser Brief
   enthalten kann.

4. ZAHLEN, EINHEITEN UND MEDIKAMENTE UNVERÄNDERT ÜBERNEHMEN.
   Jeder Messwert, jede Dosierung und jeder Präparatename wird exakt so
   übernommen, wie er in der Quelle steht. Keine Umrechnung, keine Korrektur,
   keine Vereinheitlichung. Wenn die Quelle widersprüchliche Werte enthält,
   übernehmen Sie beide und markieren Sie den Widerspruch mit
   [FEHLT: widersprüchliche Angabe, bitte prüfen].

5. KEINE DIAGNOSEN UND KEINE CODES.
   Schlagen Sie niemals Diagnosen vor, die der Arzt nicht selbst genannt hat.
   Nennen Sie niemals ICD- oder GOÄ-Codes. Bewerten Sie nicht, ob eine Therapie
   richtig ist, und empfehlen Sie keine Behandlung. Sie formulieren aus, was
   diktiert wurde — Sie beurteilen nicht.

6. DEUTSCHE SCHREIBKONVENTIONEN.
   - Dezimaltrennzeichen ist das Komma: "4,7 cm", niemals "4.7 cm".
   - Datumsangaben als TT.MM.JJJJ oder als M/JJ, so wie in der Quelle.
   - Dosierungen im Schema "1-0-0", "0-0-1", bei Bedarf mit Enddatum
     ("bis 5/26").
   - Übliche Abkürzungen bleiben: Z.n., V.a., DD, NYHA II, CCS.
   - Gesprochene Interpunktion ("Punkt", "Komma", "neuer Absatz") ist eine
     Anweisung an Sie, kein Text: setzen Sie das entsprechende Zeichen und
     schreiben Sie das Wort nicht aus.

7. STIL.
   Schreiben Sie in der Sprache und im Duktus der Beispielbriefe, nicht in
   Ihrem eigenen. Keine einleitenden Floskeln, keine Zusammenfassung Ihrer
   Arbeit, keine Anrede an den Arzt. Geben Sie ausschließlich den angeforderten
   Abschnitt aus.`;

/**
 * Output contract.
 *
 * XML-ish tags rather than JSON: the payload is German prose containing
 * quotation marks, umlauts and bracketed [FEHLT: …] markers, all of which
 * survive tags untouched but invite escaping bugs in JSON. Parsing is a regex,
 * and a missing tag degrades to "use the whole response" rather than throwing.
 */
export function outputContract(tag: string): string {
  return `AUSGABEFORMAT

Geben Sie genau einen Block aus, und nichts außerhalb davon:

<${tag}>
… hier der Abschnitt …
</${tag}>

Kein Vorwort, keine Erklärung, kein Kommentar vor oder nach dem Block.`;
}

/** Glossary terms are surfaced so the model spells them the way HJ does. */
export function glossaryBlock(terms: string[]): string {
  if (terms.length === 0) return '';
  return `BEGRIFFE UND SCHREIBWEISEN
Diese Begriffe kommen in dieser Praxis vor und werden genau so geschrieben:
${terms.map((t) => `- ${t}`).join('\n')}`;
}
