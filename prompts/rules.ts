/**
 * Shared drafting rules, embedded in every prompt that produces letter text.
 *
 * Versioned deliberately: a prompt change is a behaviour change, and the eval
 * must be re-run against it. Bump PROMPT_VERSION whenever this text changes so
 * a result can be traced back to the rules that produced it.
 *
 * Written in German on purpose. The source, the examples, the output and the
 * terminology are all German; instructing in English invites translation drift
 * in exactly the vocabulary that must not drift.
 *
 * HISTORY NOTE — where the [FEHLT: …] markers went. Earlier versions made the
 * model flag every gap with a bracketed marker, and the UI rendered them as a
 * checklist. That was built for a world where the notes were the only thing
 * the doctor saw. The app now keeps the full transcript (and the audio) next
 * to the notes, so the ground truth is always one tab away — and the doctor
 * asked for plain output he can paste without cleaning brackets out of it.
 * The safety rules the markers enforced (never invent, never guess a dose)
 * survive below; the failure mode changed from "flagged gap" to "silent
 * omission with the transcript in reach", which is the meeting-notes model.
 */

export const PROMPT_VERSION = '2026-08-24.3';

/**
 * The non-negotiable rules. Ordered by consequence: the first three are the
 * ones that could change patient care if broken.
 */
export const CORE_RULES = `GRUNDREGELN — diese gelten ausnahmslos und haben Vorrang vor allem anderen:

1. NIEMALS ETWAS ERFINDEN.
   Verwenden Sie ausschließlich Angaben, die in der Aufnahme vorkommen.
   Ergänzen Sie nichts aus medizinischem Allgemeinwissen, auch wenn es
   naheliegend wäre. Was fehlt, unverständlich oder nicht verwertbar ist,
   lassen Sie schlicht weg — der Arzt hat das vollständige Transkript neben
   den Notizen. Keine Platzhalter, keine Markierungen in Klammern, keine
   Kommentare über Lücken. Raten Sie nicht. Runden Sie nicht.

2. NEGATIONEN BLEIBEN WÖRTLICH ERHALTEN.
   "keine Angina pectoris" darf niemals zu "Angina pectoris" werden, und eine
   ausgesprochene Verneinung darf nicht wegfallen — ein fehlendes "verneint"
   liest der nächste Arzt als "nie gefragt". Prüfen Sie jede Verneinung
   einzeln: kein, keine, nicht, ohne, verneint, nie. Eine Frage des Arztes
   ohne klare Antwort ist KEINE Verneinung.

3. DOSIERUNGEN NIEMALS RATEN, UNBRAUCHBARES NIEMALS BERICHTEN.
   Ein Einnahmeschema hat drei Angaben ("1-0-0"). Ist nur ein Teil erkennbar,
   schreiben Sie Präparat und Stärke und lassen das Schema weg — ergänzen Sie
   den fehlenden Wert NICHT, auch nicht, wenn er sich aufdrängt.
   Lässt sich eine Medikationsangabe auch nach allen Korrekturen im Gespräch
   nicht in die Form Präparat + Stärke bringen, erscheint sie NIRGENDS im
   Text: nicht als Listenzeile, nicht im Fließtext, nicht als Bericht ("es
   wurde ... verordnet"), nicht mit Einschränkung ("laut Patient"). Sie
   entfällt ersatzlos — das Transkript daneben zeigt sie dem Arzt.
   Das gilt für die GANZE Angabe, sobald ein Teil von ihr wirr ist: ein
   unsinniges Intervall ("alle zwei Stunden, jeden Tag"), ein Nicht-Medikament
   als Präparat ("Cholesterin geben"), eine erkennbar nicht ernst gemeinte
   Verordnung. Aus einer solchen Passage wird KEIN einzelnes Medikament
   herausgelöst, auch wenn es für sich genommen plausibel aussieht. Im
   Zweifel, ob eine Medikationsangabe ernst gemeint und richtig erkannt ist,
   lassen Sie sie weg. Eine geratene oder nacherzählte Dosierung ist der
   gefährlichste Fehler, den dieser Text enthalten kann.

4. ZAHLEN, EINHEITEN UND MEDIKAMENTE UNVERÄNDERT ÜBERNEHMEN.
   Jeder Messwert und jeder Präparatename wird exakt so übernommen, wie er
   gesagt wurde. Keine Umrechnung, keine Korrektur, keine Vereinheitlichung.
   Nennt die Aufnahme zwei widersprüchliche Werte, ohne dass einer
   zurückgenommen wird, übernehmen Sie beide mit ihrer Herkunft nebeneinander
   ("aktuell 80 kg, beim Hausarzt 86 kg") — entscheiden Sie sich niemals
   stillschweigend für einen.

5. KEINE DIAGNOSEN UND KEINE CODES.
   Stellen Sie keine Diagnose, die in der Aufnahme nicht gestellt wurde, und
   nennen Sie niemals ICD- oder GOÄ-Codes. Setzen Sie keine Fachbezeichnung
   für Alltagssprache ein: aus "hohes Cholesterin" wird nicht
   "Hypercholesterinämie", aus "Herzanfall" nicht "Myokardinfarkt". Wurde der
   Fachbegriff gesprochen, verwenden Sie ihn.

6. DEUTSCHE SCHREIBKONVENTIONEN.
   - Dezimaltrennzeichen ist das Komma: "4,7 cm", niemals "4.7 cm".
   - Dosierungen im Schema "1-0-0", "0-0-1", bei Bedarf mit Ende ("bis 5/26").
   - Übliche Abkürzungen bleiben: Z.n., V.a., NYHA II.
   - Deutsche Rechtschreibung mit ß, niemals die Schweizer Schreibung mit ss.
   - Gesprochene Interpunktion ("Punkt", "Komma", "neuer Absatz") ist eine
     Anweisung, kein Text.

7. NUR DER ANGEFORDERTE INHALT.
   Kein Vorwort, keine Erklärung, keine Anrede, kein Kommentar über die
   Aufnahme oder ihre Qualität — weder im Text noch daneben.

8. EIN GESPRÄCH IST EINE UNAUFGERÄUMTE QUELLE. Das ist normal.
   - Eine Frage ist keine Angabe; nur die Antwort ist eine. Wiederholt der
     Arzt eine Antwort ("Gut, 50."), ist das dieselbe Angabe, kein zweiter Wert.
   - Korrigiert sich DIESELBE Person ("Atorvastatin — nein, Rosuvastatin"),
     gilt die zuletzt genannte Fassung. Die zurückgenommene erscheint NIRGENDS
     — nicht als eigene Zeile, nicht als Zusatz, nicht in Klammern.
   - Widerspricht eine ANDERE Person, ist das keine Korrektur, sondern ein
     Widerspruch: Regel 4, beide Angaben mit Quelle.
   - Begrüßung, Smalltalk, Organisatorisches und Technisches lassen Sie
     ersatzlos weg.

9. ENTHÄLT DIE AUFNAHME KEINERLEI MEDIZINISCHEN INHALT (etwa eine Tonprobe),
   geben Sie in jedem angeforderten Abschnitt genau diesen einen Satz aus:
   Kein medizinischer Inhalt erkannt.`;

/**
 * Output contract. XML-ish tags rather than JSON: the payload is German prose
 * with quotation marks and umlauts, which survive tags untouched but invite
 * escaping bugs in JSON. Parsing is a regex, and a missing tag degrades to
 * "use the whole response" rather than throwing.
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
