import { HJ_STYLE } from './beurteilung.ts';
import { CORE_RULES, glossaryBlock, PROMPT_VERSION } from './rules.ts';

/**
 * A dictated SECTION of a Bericht — the in-document dictation. Unlike the
 * Beurteilung this has no fixed name: the doctor may announce what section
 * he is dictating ("Dieser Abschnitt ist ..."), and that announcement is an
 * instruction to be understood, never text to be transcribed.
 */

export const ABSCHNITT_TAG = 'abschnitt';
export const ABSCHNITT_TITEL_TAG = 'abschnitt_titel';

export interface AbschnittPromptInput {
  transcript: string;
  glossary: string[];
}

/** Stable half — rules, style, contract. Carries the cache breakpoint. */
export function buildAbschnittSystemPrompt(glossary: string[]): string {
  return `Sie unterstützen einen deutschen Kardiologen beim Schreiben von Arztbriefen.

Der Arzt diktiert EINEN ABSCHNITT eines Berichts in ein Dokument. Sie
formulieren das Diktat aus — in seinem Stil, in seiner Reihenfolge, mit
seinen Formulierungen. Der Arzt liest und gibt jeden Brief selbst frei;
Ihr Text ist ein Entwurf, keine fertige Aussage.

${CORE_RULES}

ABSCHNITTSERKENNUNG
Kündigt der Arzt zu Beginn einen Abschnitt an — zum Beispiel "Dieser
Abschnitt ist ...", "Abschnitt ...", "Überschrift ...", "Jetzt kommt ...",
"Als Nächstes ..." — geben Sie den Titel im Titel-Block aus. Entspricht der
genannte Titel sinngemäß einem seiner üblichen Abschnitte, verwenden Sie
genau diese Schreibweise:

- Diagnosen
- Anamnese
- Befunde
- Zusammenfassende Beurteilung
- Aktuelle Therapie

Beispiele: "die Beurteilung" oder "zusammenfassende Beurteilung" wird zu
"Zusammenfassende Beurteilung"; "Therapie", "Medikation" oder "aktuelle
Medikamente" wird zu "Aktuelle Therapie"; "Vorgeschichte" wird zu
"Anamnese"; "die Werte" oder "Messwerte" wird zu "Befunde". Ein frei
gewählter Titel ("Analyse", "Verlauf", ...) bleibt wörtlich erhalten, mit
großem Anfangsbuchstaben. Ohne Ankündigung bleibt der Titel-Block leer.
Die Ankündigung selbst ist eine Anweisung an Sie — sie erscheint niemals
im Text des Abschnitts.

AUFBAU DES ABSCHNITTS
Der Abschnitt besteht aus Aufzählungspunkten, jeweils mit "- " beginnend.
Ein Punkt pro Gedanke, in der Reihenfolge, in der der Arzt sie genannt
hat. Vollständige Sätze, kein Telegrammstil.

${HJ_STYLE}

${glossaryBlock(glossary)}

AUSGABEFORMAT
Antworten Sie ausschließlich in genau dieser Form, ohne Text davor oder
danach:

<${ABSCHNITT_TITEL_TAG}>Titel des Abschnitts, oder leer</${ABSCHNITT_TITEL_TAG}>
<${ABSCHNITT_TAG}>
- Erster Punkt ...
- Zweiter Punkt ...
</${ABSCHNITT_TAG}>`;
}

/** Volatile half — this dictation. Never cached. */
export function buildAbschnittUserPrompt(
  input: Pick<AbschnittPromptInput, 'transcript'>,
): string {
  return `DIKTAT (automatische Spracherkennung, kann Erkennungsfehler enthalten):

${input.transcript.trim()}

Erstellen Sie daraus den Abschnitt.`;
}

export const ABSCHNITT_PROMPT_VERSION = PROMPT_VERSION;

/**
 * Pull heading and text out of the response. Deliberately forgiving, like
 * its siblings: a draft the doctor can edit beats an exception.
 */
export function parseAbschnitt(raw: string): {
  heading: string | null;
  text: string;
  wellFormed: boolean;
} {
  const titleMatch = raw.match(
    new RegExp(`<${ABSCHNITT_TITEL_TAG}>([\\s\\S]*?)</${ABSCHNITT_TITEL_TAG}>`, 'i'),
  );
  const heading = titleMatch?.[1]?.trim() ? titleMatch[1].trim() : null;

  const match = raw.match(new RegExp(`<${ABSCHNITT_TAG}>([\\s\\S]*?)</${ABSCHNITT_TAG}>`, 'i'));
  if (match?.[1]) return { heading, text: match[1].trim(), wellFormed: true };

  const open = raw.match(new RegExp(`<${ABSCHNITT_TAG}>([\\s\\S]*)`, 'i'));
  if (open?.[1]) return { heading, text: open[1].trim(), wellFormed: false };

  // No tags at all: strip a possibly-present title tag remnant and return the rest.
  const withoutTitle = titleMatch ? raw.replace(titleMatch[0], '') : raw;
  return { heading, text: withoutTitle.trim(), wellFormed: false };
}
