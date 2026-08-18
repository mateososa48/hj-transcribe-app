import { CORE_RULES, glossaryBlock, PROMPT_VERSION } from './rules.ts';

/**
 * The consultation feature: one recorded patient conversation in, three
 * sections of his letter out.
 *
 * These are the sections he currently fills by writing on paper during the
 * conversation and then typing off that paper afterwards — the slowest part of
 * his day after the summary. Everything measured by a machine (echo, ECG) is
 * deliberately out of scope: he reads those off the device long after the
 * patient has left, and no microphone in the room can know them.
 *
 * Three sections in ONE call, not three. The model has to see the whole
 * conversation to know that a drug mentioned in passing belongs in the
 * medication list and not in the history, and one pass is also the difference
 * between waiting once and waiting three times.
 */

export const GESPRAECH_SECTIONS = ['diagnosen', 'anamnese', 'medikation'] as const;
export type GespraechSection = (typeof GESPRAECH_SECTIONS)[number];

export const GESPRAECH_SECTION_LABELS: Record<GespraechSection, string> = {
  diagnosen: 'Diagnosen',
  anamnese: 'Anamnese',
  medikation: 'Medikation',
};

export interface GespraechPromptInput {
  transcript: string;
  /** Previous letter, pasted by HJ. Diagnoses are largely carried forward. */
  vorbrief?: string;
  glossary: string[];
}

/**
 * Structure and voice for the three sections.
 *
 * Every rule here was read off his own letters, not invented: the nested
 * diagnosis bullets with their parenthetical measurements, the terse prose of
 * the history, and the two-column medication list with a bare strength and no
 * unit ("ASS 100", never "ASS 100 mg").
 */
export const SECTION_GUIDE = `AUFBAU DER DREI ABSCHNITTE

Jeder Abschnitt hat seine eigene Form. Verwechseln Sie sie nicht.

DIAGNOSEN — Aufzählung, keine Prosa.
  Ein Aufzählungspunkt pro Diagnose, beginnend mit "- ". Die wichtigste
  kardiologische Diagnose steht oben, danach die übrigen, zuletzt die nicht
  kardialen.
  Gehören Einzelheiten zu einer Diagnose, stehen sie eingerückt darunter:
      - Koronare Herzkrankheit mit
        - Z.n. DES-Implantation der LAD 12/23
        - Z.n. Vorderwandinfarkt 3/25
  Zusatzangaben stehen in Klammern hinter der Diagnose, mit Messwert und
  Herkunft: "Aneurysma der Aorta ascendens (4,7 cm, CT 8/25)".
  Zeitangaben knapp: "10/25", "28.12.2023", "3/25". Abkürzungen wie er sie
  verwendet: Z.n., V.a., DD.
  Risikofaktoren werden gebündelt:
      - Kardiovaskuläre Risikofaktoren mit
        - Arterielle Hypertonie
        - Nikotinabusus, sistiert 2016

ANAMNESE — kurze Prosa, keine Aufzählung.
  Ganze, aber knappe Sätze hintereinander. Kein Telegrammstil, aber auch keine
  ausschweifenden Nebensätze — dieser Abschnitt ist eine Aufstellung, kein
  Bericht. Vorbild:
      "Z.n. Fraktur des rechten Unterarms. Keine weiteren wesentlichen
      Erkrankungen. Regelmäßige sportliche Aktivität. Pollinosis."
  Reihenfolge: aktuelle Beschwerden, dann Vorerkrankungen und Operationen, dann
  Risikofaktoren und Gewohnheiten (Rauchen, Alkohol, Sport), dann
  Familienanamnese, dann Allergien und Unverträglichkeiten.
  Beschwerden werden mit ihren Umständen genannt, so wie der Patient sie
  beschreibt: wobei sie auftreten, wie lange, was sie beendet.
  Was der Patient verneint hat, wird als Verneinung aufgeschrieben und nicht
  weggelassen: "Eine Belastungsdyspnoe wird verneint."

MEDIKATION — Liste, ein Präparat pro Zeile.
  Format: Präparatename, Leerzeichen, Stärke, dann ein TABULATOR, dann das
  Einnahmeschema.
      ASS 100	1-0-0
      Clopidogrel 75	1-0-0 bis 5/26
      Sevikar 40/5	1-0-0
      Rosuvastatin 20	0-0-1
  Die Stärke steht OHNE Einheit, so wie er sie schreibt: "ASS 100", niemals
  "ASS 100 mg". Gesprochenes "ASS hundert" wird zu "ASS 100".
  Ein befristetes Präparat bekommt das Ende angehängt: "1-0-0 bis 5/26".
  Nimmt der Patient nichts, besteht der Abschnitt aus dem einen Wort:
      Keine`;

/**
 * The half that never changes between patients — cache this.
 *
 * `guide` exists so the battery can A/B a candidate section guide without
 * editing this file, which is what makes several candidates testable in
 * parallel. Production always passes nothing and gets SECTION_GUIDE.
 */
export function buildGespraechSystemPrompt(glossary: string[], guide = SECTION_GUIDE): string {
  return `Sie unterstützen einen deutschen Kardiologen beim Schreiben von Arztbriefen.

Sie bekommen die AUFNAHME EINES SPRECHSTUNDENGESPRÄCHS zwischen dem Arzt und
dem Patienten. Daraus erstellen Sie genau drei Abschnitte seines Briefes:
Diagnosen, Anamnese und Medikation. Der Arzt liest und korrigiert alles selbst;
Ihr Text ist ein Entwurf, keine fertige Aussage.

Ein Gespräch ist keine geordnete Quelle. Die Angaben kommen durcheinander, der
Patient korrigiert sich, die Begleitperson widerspricht, es wird über anderes
geredet. Ihre Aufgabe ist das Ordnen — nicht das Ergänzen.

${CORE_RULES}

${guide}

WAS NICHT IN DIESE ABSCHNITTE GEHÖRT
- Messwerte aus Echokardiographie, EKG, Belastungstest oder Labor. Diese
  Untersuchungen finden nach dem Gespräch statt; was im Gespräch darüber gesagt
  wird, ist eine Ankündigung und kein Befund. Nehmen Sie nichts davon auf.
- Ihre eigene Einschätzung, eine Zusammenfassung oder eine Empfehlung. Die
  Beurteilung diktiert der Arzt später selbst.
- Begrüßung, Small Talk, Organisatorisches ("kommen Sie mit rüber", "legen Sie
  sich hin"), Gespräche über das Aufnahmegerät.

${glossaryBlock(glossary)}

AUSGABEFORMAT

Geben Sie genau diese drei Blöcke aus, in dieser Reihenfolge, und nichts
außerhalb davon:

<diagnosen>
…
</diagnosen>
<anamnese>
…
</anamnese>
<medikation>
…
</medikation>

Ein Abschnitt, zu dem das Gespräch nichts hergibt, bleibt nicht weg — der Block
steht trotzdem da und enthält genau diese eine Zeile, mit Bindestrich wie jeder
andere Punkt auch:
    - [FEHLT: im Gespräch nicht besprochen]

Kein Vorwort, keine Erklärung, kein Kommentar vor oder nach den Blöcken.`;
}

/** The half that changes per patient — never cached. */
export function buildGespraechUserPrompt(
  input: Pick<GespraechPromptInput, 'transcript' | 'vorbrief'>,
): string {
  const vorbrief = input.vorbrief?.trim()
    ? `VORHERIGER BRIEF DIESES PATIENTEN

Übernehmen Sie die dort aufgeführten Diagnosen, soweit das Gespräch ihnen nicht
widerspricht, und ergänzen Sie, was im Gespräch neu hinzugekommen ist. Aus der
Anamnese und der Medikation des Vorbriefs übernehmen Sie nur, was im aktuellen
Gespräch bestätigt wurde — eine abgesetzte Tablette steht sonst für immer im
Brief.

${input.vorbrief.trim()}

`
    : '';

  return `${vorbrief}GESPRÄCHSAUFNAHME (automatische Spracherkennung, kann Erkennungsfehler enthalten):

${input.transcript.trim()}

Erstellen Sie daraus die drei Abschnitte.`;
}

export const GESPRAECH_PROMPT_VERSION = PROMPT_VERSION;

const EMPTY = (): Record<GespraechSection, string> => ({
  diagnosen: '',
  anamnese: '',
  medikation: '',
});

/**
 * Pull the three sections out of the response.
 *
 * Forgiving on purpose, like the Beurteilung parser: a section that arrives
 * without its closing tag is still worth showing him. `wellFormed` is false
 * whenever anything had to be recovered, so the UI can say so.
 */
export function parseGespraech(raw: string): {
  sections: Record<GespraechSection, string>;
  wellFormed: boolean;
} {
  const sections = EMPTY();
  let wellFormed = true;

  for (const key of GESPRAECH_SECTIONS) {
    const closed = raw.match(new RegExp(`<${key}>([\\s\\S]*?)</${key}>`, 'i'));
    if (closed?.[1] !== undefined) {
      sections[key] = closed[1].trim();
      continue;
    }
    // Unclosed: take everything up to the next opening tag, or to the end.
    const open = raw.match(new RegExp(`<${key}>([\\s\\S]*?)(?=<(?:${GESPRAECH_SECTIONS.join('|')})>|$)`, 'i'));
    if (open?.[1] !== undefined) {
      sections[key] = open[1].replace(/<\/?\w+>\s*$/, '').trim();
      wellFormed = false;
      continue;
    }
    wellFormed = false;
  }

  return { sections, wellFormed };
}
