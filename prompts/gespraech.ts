import { CORE_RULES, PROMPT_VERSION } from './rules.ts';

/**
 * The appointment feature: one recorded consultation in, meeting notes out.
 *
 * Four sections: a Granola-style summary of the appointment, then the three
 * blocks of his letter that come from conversation (Diagnosen, Anamnese,
 * Medikation). Everything measured by a machine (echo, ECG) is out of scope —
 * those numbers are read off devices after the patient leaves, and no
 * microphone in the room can know them.
 *
 * One call, not four: the model has to see the whole conversation to know
 * that a drug mentioned in passing belongs in the medication list.
 */

export const GESPRAECH_SECTIONS = [
  'zusammenfassung',
  'diagnosen',
  'anamnese',
  'medikation',
] as const;
export type GespraechSection = (typeof GESPRAECH_SECTIONS)[number];

export const GESPRAECH_SECTION_LABELS: Record<GespraechSection, string> = {
  zusammenfassung: 'Zusammenfassung',
  diagnosen: 'Diagnosen',
  anamnese: 'Anamnese',
  medikation: 'Medikation',
};

/**
 * Structure for the four sections. The letter-bound three keep the formats
 * read off his real letters; the summary is deliberately generic meeting-notes
 * material — he will shape it once he has used it.
 */
export const SECTION_GUIDE = `AUFBAU DER VIER ABSCHNITTE

ZUSAMMENFASSUNG — kurze Aufzählung, wie gute Besprechungsnotizen.
  Drei bis sechs Punkte, jeweils mit "- " beginnend, in dieser Art:
  Anlass des Termins, die wichtigsten Angaben des Patienten, was besprochen
  oder entschieden wurde, was als Nächstes ansteht. Knapp und sachlich; ein
  Punkt pro Gedanke. Nichts hineinschreiben, was nicht gesagt wurde.

DIAGNOSEN — Aufzählung, keine Prosa.
  Ein Punkt pro Erkrankung, beginnend mit "- ". Kardiologisches zuerst.
  Einzelheiten eingerückt darunter:
      - Koronare Herzkrankheit mit
        - Z.n. Vorderwandinfarkt 11/22
  Zeitangaben knapp ("11/22", "2019"). Nur Erkrankungen und Eingriffe, die im
  Gespräch genannt wurden.

ANAMNESE — knappe Prosa, keine Aufzählung.
  Ganze, kurze Sätze: aktuelle Beschwerden mit ihren Umständen, Belastbarkeit,
  ausgesprochene Verneinungen, Vorerkrankungen und Operationen, Gewohnheiten
  (Rauchen, Alkohol, Sport), Familienanamnese, Allergien. Kürze entsteht durch
  Weglassen von Gespräch, niemals durch Weglassen von Befunden — jede
  ausgesprochene Verneinung steht im Text, zusammengefasst ist erlaubt:
      "Luftnot, Palpitationen, Schwindel und Beinödeme werden verneint."

MEDIKATION — Liste, ein Präparat pro Zeile.
  Präparatename und Stärke OHNE Einheit, dann ein TABULATOR, dann das Schema:
      ASS 100	1-0-0
      Clopidogrel 75	1-0-0 bis 5/26
      Rosuvastatin 20	0-0-1
  "ASS hundert" wird zu "ASS 100", niemals zu "ASS 100 mg". Fehlt das Schema,
  steht die Zeile ohne Schema da. Jedes Präparat erscheint genau einmal und
  nur in seiner endgültigen Fassung — ein im Gespräch zurückgenommener Name
  taucht nicht auf, auch nicht in Klammern. Nimmt der Patient nichts, besteht
  der Abschnitt aus dem einen Wort:
      Keine`;

export interface GespraechPromptInput {
  /** The conversation, one line per turn: "Arzt: …" / "Patient: …" / "Sprecher 1: …". */
  transcript: string;
}

/** The half that never changes between patients — cache this. */
export function buildGespraechSystemPrompt(glossary: string[], guide = SECTION_GUIDE): string {
  const glossaryBlock = glossary.length
    ? `\nBEGRIFFE DIESER PRAXIS, genau so geschrieben:\n${glossary.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  return `Sie unterstützen einen deutschen Kardiologen. Sie bekommen das
TRANSKRIPT EINES SPRECHSTUNDENGESPRÄCHS, nach Sprechern getrennt, und erstellen
daraus vier Abschnitte seiner Notizen. Der Arzt liest und korrigiert alles
selbst; das Transkript und die Tonaufnahme liegen ihm daneben vor.

Wer von den Sprechern der Arzt ist, erkennen Sie am Gesprächsverlauf, falls die
Sprecher nicht benannt sind.

${CORE_RULES}

${guide}

WAS NICHT IN DIESE ABSCHNITTE GEHÖRT
- Messwerte aus Echokardiographie, EKG, Belastungstest oder Labor, die erst
  nach dem Gespräch erhoben werden. Was im Gespräch darüber angekündigt wird,
  ist kein Befund.
- Ihre eigene Einschätzung oder Empfehlung. Die Beurteilung diktiert der Arzt
  selbst.
${glossaryBlock}
AUSGABEFORMAT

Geben Sie genau diese vier Blöcke aus, in dieser Reihenfolge, und nichts
außerhalb davon:

<zusammenfassung>
…
</zusammenfassung>
<diagnosen>
…
</diagnosen>
<anamnese>
…
</anamnese>
<medikation>
…
</medikation>

Ein Abschnitt, zu dem das Gespräch nichts hergibt, bleibt leer — der Block
steht trotzdem da, ohne Inhalt.`;
}

/** The half that changes per patient — never cached. */
export function buildGespraechUserPrompt(input: GespraechPromptInput): string {
  return `TRANSKRIPT DES GESPRÄCHS (automatische Spracherkennung, kann Erkennungsfehler enthalten):

${input.transcript.trim()}

Erstellen Sie daraus die vier Abschnitte.`;
}

export const GESPRAECH_PROMPT_VERSION = PROMPT_VERSION;

const EMPTY = (): Record<GespraechSection, string> => ({
  zusammenfassung: '',
  diagnosen: '',
  anamnese: '',
  medikation: '',
});

/**
 * Pull the sections out of the response. Forgiving on purpose: a section that
 * arrives without its closing tag is still worth showing. `wellFormed` is
 * false whenever anything had to be recovered, so the UI can say so.
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
    const open = raw.match(
      new RegExp(`<${key}>([\\s\\S]*?)(?=<(?:${GESPRAECH_SECTIONS.join('|')})>|$)`, 'i'),
    );
    if (open?.[1] !== undefined) {
      sections[key] = open[1].replace(/<\/?\w+>\s*$/, '').trim();
      wellFormed = false;
      continue;
    }
    wellFormed = false;
  }

  return { sections, wellFormed };
}
