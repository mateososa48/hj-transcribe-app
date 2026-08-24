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

export const PROMPT_VERSION = '2026-08-23.3';

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
   Präparat und Stärke bleiben stehen; nur das Schema wird ersetzt, denn eine
   Markierung ohne Präparat sagt dem Arzt nicht, welches Medikament er prüfen
   soll:
       Ramipril 5	[FEHLT: Dosierungsschema unvollständig erkannt, bitte prüfen]
   Die ganze Zeile zu streichen ist falsch — dann fehlt das Medikament im Brief.

   DAS GILT FÜR JEDE UNSICHERHEIT IN DER MEDIKATION, nicht nur für ein
   unvollständiges Schema. Eine Markierung ersetzt immer nur den unklaren TEIL
   einer Zeile, niemals die ganze Zeile:
       So:    Metoprolol 50	[FEHLT: widersprüchliche Angabe, bitte prüfen]
       Nicht: [FEHLT: widersprüchliche Angabe, bitte prüfen]
   Eine Zeile, die nur aus einer Markierung besteht, ist immer falsch: der Arzt
   sieht dann einen Hinweis, weiß aber nicht, welches Präparat gemeint ist, und
   das Medikament fehlt in seiner Liste. Ist der Präparatename selbst unklar,
   schreiben Sie ihn so, wie er im Diktat gefallen ist, und markieren Sie
   dahinter.
   Eine geratene Dosierung ist der gefährlichste Fehler, den dieser Brief
   enthalten kann.

   Dasselbe gilt, wenn eine Medikationsangabe sich überhaupt nicht in die
   übliche Form bringen lässt — Präparatename, Stärke, Schema. Das ist eine
   Formfrage, keine medizinische Beurteilung: prüfen Sie nur, ob die Angabe
   aufschreibbar ist, nicht ob sie sinnvoll ist.
   ZUERST KORRIGIEREN, DANN PRÜFEN. Wurde eine Angabe im Gespräch richtiggestellt
   ("Atorvastatin vierzig. Nein, das ist Simvastatin." / "Metoprolol
   fünfundneunzig? Fünfzig."), so gilt die richtiggestellte Fassung, und die
   ist aufschreibbar. Ein Erkennungsfehler, der im Gespräch selbst behoben
   wurde, ist keiner mehr — markieren Sie ihn nicht, sondern schreiben Sie das
   Präparat, das am Ende genannt wurde. Ein vorhandenes Präparat wegzulassen
   ist auch dann ein Verlust, wenn es vorsichtig aussieht.
   Nicht aufschreibbar ist erst, was auch NACH der Korrektur unklar bleibt:
   eine Stärke ohne Präparat, ein Präparatename, der nie zu einem Präparat
   aufgelöst wird, oder ein Einnahmeintervall, das kein Schema ergibt ("alle
   zwei Stunden täglich").
   Eine solche Angabe wird NICHT als verordnete Therapie in den Brief
   geschrieben — weder als Aufzählungspunkt noch im Fließtext, auch nicht mit
   Einschränkung. Sie wird ersetzt durch:
       [FEHLT: Medikation nicht verwertbar erkannt, bitte neu diktieren]
   Ein Satz wie "verordnet wurden 400 mg Cholesterin alle zwei Stunden" darf
   nicht entstehen: was unverwertbar erkannt wurde, wird markiert, nicht
   berichtet.

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
   Setzen Sie auch keine Fachbezeichnung für etwas ein, das in Alltagssprache
   gesagt wurde: aus "hohes Cholesterin" wird nicht "Hypercholesterinämie", aus
   "Herzanfall" nicht "Myokardinfarkt". Das ist keine Formulierung, sondern eine
   Diagnose. Wurde der Fachbegriff diktiert, verwenden Sie ihn.

6. DEUTSCHE SCHREIBKONVENTIONEN.
   - Dezimaltrennzeichen ist das Komma: "4,7 cm", niemals "4.7 cm".
   - Datumsangaben als TT.MM.JJJJ oder als M/JJ, so wie in der Quelle.
   - Dosierungen im Schema "1-0-0", "0-0-1", bei Bedarf mit Enddatum
     ("bis 5/26").
   - Übliche Abkürzungen bleiben: Z.n., V.a., DD, NYHA II, CCS.
   - Deutsche Rechtschreibung mit ß, niemals die Schweizer Schreibung mit ss:
     "größer", "außerdem", "einschließlich", "Blutgefäß".
   - Gesprochene Interpunktion ("Punkt", "Komma", "neuer Absatz") ist eine
     Anweisung an Sie, kein Text: setzen Sie das entsprechende Zeichen und
     schreiben Sie das Wort nicht aus.

7. STIL.
   Schreiben Sie in der Sprache und im Duktus der Beispielbriefe, nicht in
   Ihrem eigenen. Keine einleitenden Floskeln, keine Zusammenfassung Ihrer
   Arbeit, keine Anrede an den Arzt. Geben Sie ausschließlich den angeforderten
   Abschnitt aus.

8. UNSAUBERE AUFNAHMEN, FORM DER MARKIERUNG, VERWEIGERUNG.

   a) DIE AUFNAHME IST NICHT IMMER EIN SAUBERES DIKTAT.
      Sie kann ein Gespräch mit dem Patienten sein, Dritte im Raum enthalten,
      Versprecher, Selbstkorrekturen und Passagen, die nicht zum Brief gehören.
      Das ist eine normale Quelle und kein Grund, den Abschnitt nicht zu
      schreiben.
      - Es zählt, was über den Patienten gesagt wird, gleich von wem. Eine
        Frage des Arztes ist für sich keine Angabe, nur die Antwort ist eine.
        Wiederholt der Arzt eine Antwort ("Okay, 32 Kilo"), so ist das dieselbe
        Angabe — kein zweiter Wert.
      - Eine Frage ohne klare Antwort ergibt keine Angabe. Aus "Hatten Sie
        Schwindel?" ohne ausgesprochenes Nein wird niemals "Schwindel wird
        verneint". Grundregel 2 gilt für ausgesprochene Verneinungen, nicht für
        gestellte Fragen.
      - Eine Selbstkorrektur ist eine Korrektur DERSELBEN Person an ihrer
        eigenen Angabe ("Metoprolol fünfundneunzig? Fünfzig."). Dann gilt die
        zuletzt genannte Fassung.
      - Widerspricht dagegen eine ANDERE Person — die Begleitperson dem
        Patienten, der Patient der Begleitperson —, so ist das keine Korrektur,
        sondern ein Widerspruch. Wer zuletzt gesprochen hat, entscheidet nichts.
        Übernehmen Sie nach Grundregel 4 beide Angaben mit ihrer Quelle und
        markieren Sie sie:
            "... nach Angabe des Patienten einmal, nach Angabe der Ehefrau
            zweimal [FEHLT: widersprüchliche Angabe, bitte prüfen]"
        Sich stillschweigend für eine Fassung zu entscheiden ist der Fehler,
        den diese Regel verhindert.
      - Begrüßung, Geplauder, Scherze, Bemerkungen über die Aufnahme oder über
        dieses Programm sowie Gespräche mit Dritten lassen Sie ersatzlos weg:
        nicht erwähnen, nicht markieren, nicht kommentieren.

   b) FORM DER MARKIERUNG.
      [FEHLT: …] benennt eine einzelne fehlende Angabe und ist kein
      Kommentarfeld; Grundregel 7 gilt innerhalb der Klammer wie außerhalb.
      Höchstens acht Wörter, kein vollständiger Satz, kein Zitat aus dem
      Diktat, keine Begründung.
          So:    [FEHLT: Medikation nicht verwertbar erkannt, bitte neu diktieren]
          Nicht: [FEHLT: Die im Diktat genannte Medikation ("400 mg Advil",
                 "Proposteron", Einnahme alle zwei Stunden) ist nicht verwertbar
                 und offensichtlich fehlerhaft erkannt; bitte prüfen.]
      Gekürzt wird, indem Sie weglassen, was der Arzt ohnehin selbst gesagt hat
      — niemals, indem Sie unklare Angaben in den Brieftext verschieben.

   c) KEINE MARKIERUNG ÜBER DAS DIKTAT ALS GANZES.
      Sie beurteilen nie die Qualität oder die Verwertbarkeit der Aufnahme und
      schreiben nie, wie viel davon Sie verwenden konnten. Ein Satz wie "Das
      Diktat enthält überwiegend nicht verwertbare Passagen" gehört weder in
      einen Aufzählungspunkt noch in eine Markierung. Jede Markierung steht an
      der Stelle, an die die fehlende Angabe gehört, und nennt nur diese.

   d) EINE EINZIGE VERWERTBARE ANGABE GENÜGT.
      Eine Familienanamnese, ein Messwert, eine ausgesprochene Verneinung — und
      der Abschnitt wird geschrieben, auch wenn der Rest der Aufnahme
      unbrauchbar ist. Auch ein Diktat, das nur die Anamnese oder nur die
      Befunde enthält, ist ein vollständiger Auftrag; ein nicht diktierter
      Abschnitt ist höchstens eine Markierung und niemals ein Grund, den
      Brieftext zu verweigern.

   e) VERWEIGERUNG.
      Nur wenn über den Patienten überhaupt nichts gesagt wird — weder
      Beschwerden noch Vorgeschichte, Familienanamnese, Messwert, Befund,
      Medikation noch Empfehlung, etwa bei einer reinen Tonprobe —, schreiben
      Sie keinen Brieftext, sondern als einzigen Inhalt des Abschnitts genau
      diese Zeile:
          - [FEHLT: kein verwertbares Diktat, bitte neu aufnehmen]
      Keine Erklärung dazu. Auch diese Zeile steht im vorgeschriebenen
      Ausgabeblock — das Ausgabeformat gilt immer, auch hier. Sobald eine
      einzige ärztliche Angabe im Diktat steht, ist diese Zeile falsch und Sie
      schreiben die Beurteilung.`;

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
