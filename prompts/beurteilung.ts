import type { BeurteilungExample } from './examples/dev/index.ts';
import { CORE_RULES, glossaryBlock, outputContract, PROMPT_VERSION } from './rules.ts';

/**
 * "Zusammenfassende Beurteilung" — section 5, and the one that matters most.
 *
 * The prompt is split into a STABLE half (rules + examples, identical on every
 * request) and a VOLATILE half (this patient's transcript). The stable half
 * carries the cache breakpoint; putting anything patient-specific above it
 * would invalidate the cache on every single letter.
 */

export const BEURTEILUNG_TAG = 'beurteilung';

export interface BeurteilungPromptInput {
  transcript: string;
  /** Previous letter, pasted by HJ. Used for carry-forward and comparisons. */
  vorbrief?: string;
  glossary: string[];
  examples: BeurteilungExample[];
}

/** The half that never changes between patients — cache this. */
export function buildStableSystemPrompt(
  examples: BeurteilungExample[],
  glossary: string[],
): string {
  const shots = examples
    .map(
      (ex, i) => `BEISPIEL ${i + 1}

Diktat:
${ex.transkript.trim()}

Daraus die Beurteilung:
<${BEURTEILUNG_TAG}>
${ex.beurteilung.trim()}
</${BEURTEILUNG_TAG}>`,
    )
    .join('\n\n');

  return `Sie unterstützen einen deutschen Kardiologen beim Schreiben von Arztbriefen.

Ihre Aufgabe ist ausschließlich der Abschnitt "Zusammenfassende Beurteilung".
Sie formulieren aus, was der Arzt diktiert hat — in seinem Stil, in seiner
Reihenfolge, mit seinen Formulierungen. Der Arzt liest und gibt jeden Brief
selbst frei; Ihr Text ist ein Entwurf, keine fertige Aussage.

${CORE_RULES}

AUFBAU DES ABSCHNITTS
Die Beurteilung besteht aus längeren Aufzählungspunkten, jeweils mit "- "
beginnend. Ein Punkt pro Gedanke, in der Reihenfolge, in der der Arzt sie
genannt hat. Vollständige Sätze, kein Telegrammstil.

${glossaryBlock(glossary)}

${shots}

${outputContract(BEURTEILUNG_TAG)}`;
}

/** The half that changes per patient — never cached. */
export function buildUserPrompt(input: Pick<BeurteilungPromptInput, 'transcript' | 'vorbrief'>): string {
  const vorbrief = input.vorbrief?.trim()
    ? `VORBRIEF (vorheriger Brief dieses Patienten, nur als Kontext für
Vergleiche und zur Fortschreibung von Diagnosen — übernehmen Sie daraus nichts,
was im aktuellen Diktat nicht bestätigt wird):

${input.vorbrief.trim()}

`
    : '';

  return `${vorbrief}DIKTAT (automatische Spracherkennung, kann Erkennungsfehler enthalten):

${input.transcript.trim()}

Erstellen Sie daraus die Zusammenfassende Beurteilung.`;
}

export const BEURTEILUNG_PROMPT_VERSION = PROMPT_VERSION;

/**
 * Pull the section out of the model's response.
 *
 * Deliberately forgiving: a draft the doctor can edit beats an exception. If
 * the tag is missing we return the whole response and flag it, rather than
 * losing work that is probably fine.
 */
export function parseBeurteilung(raw: string): { text: string; wellFormed: boolean } {
  const match = raw.match(
    new RegExp(`<${BEURTEILUNG_TAG}>([\\s\\S]*?)</${BEURTEILUNG_TAG}>`, 'i'),
  );
  if (match?.[1]) return { text: match[1].trim(), wellFormed: true };

  // Unclosed tag — take everything after it.
  const open = raw.match(new RegExp(`<${BEURTEILUNG_TAG}>([\\s\\S]*)`, 'i'));
  if (open?.[1]) return { text: open[1].trim(), wellFormed: false };

  return { text: raw.trim(), wellFormed: false };
}

/** Every [FEHLT: …] marker in a draft, for the review UI. */
export function extractFehltMarkers(text: string): string[] {
  return [...text.matchAll(/\[FEHLT:([^\]]*)\]/gi)].map((m) => (m[1] ?? '').trim());
}
