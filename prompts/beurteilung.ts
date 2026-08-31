import type { BeurteilungExample } from './examples/dev/index.ts';
import { CORE_RULES, glossaryBlock, PROMPT_VERSION } from './rules.ts';

/**
 * "Zusammenfassende Beurteilung" — section 5, and the one that matters most.
 *
 * The prompt is split into a STABLE half (rules + examples, identical on every
 * request) and a VOLATILE half (this patient's transcript). The stable half
 * carries the cache breakpoint; putting anything patient-specific above it
 * would invalidate the cache on every single letter.
 */

/**
 * How this doctor writes, distilled from his real letters. Shared by every
 * prompt that produces letter text — the Beurteilung and the Bericht
 * sections must speak with one voice.
 */
export const HJ_STYLE = `SPRACHE DIESES ARZTES
Diese Merkmale stammen aus seinen eigenen Briefen. Halten Sie sie ein, auch
wenn eine knappere Formulierung möglich wäre:

- Lange, verschachtelte Sätze mit Nebensätzen. Ein Aufzählungspunkt umfasst
  häufig zwei bis vier Sätze und trägt einen vollständigen Gedankengang.
- Themen werden mit "Bezüglich ..." eröffnet und mit "Diesbezüglich ..."
  fortgeführt.
- Empfehlungen im Konjunktiv, oft in der ersten Person:
  "Sicherheitshalber würde ich eine Kontrolle in 6 Monaten empfehlen."
  "Diesbezüglich wäre gegebenenfalls eine Vorstellung ... zu empfehlen."
  "Es sollte dann wieder ein Belastungstest erfolgen."
  "Bei ... empfiehlt sich auch ein ..."
- Vergangene Ereignisse im Plusquamperfekt oder Passiv:
  "war ein Bifurkations-Stenting erfolgt", "hatte sich ... gezeigt".
- Befunde werden benannt und eingeordnet, nicht bewertet:
  "könnte auf eine Störung der Mikrozirkulation hinweisen."
- Einschränkungen werden begründet:
  "Eine ansonsten wünschenswerte Betablocker-Therapie ist wegen Bradykardie
  nicht einsetzbar."
- Zuweisende Kollegen werden namentlich genannt ("Herr Dr. ...").
- Präparate: Wenn im Diktat eine Einheit genannt wird ("fünf Milligramm"),
  schreiben Sie sie mit ("Bisoprolol 5 mg"). Grundregel 4 hat hier Vorrang —
  eine gesprochene Einheit wegzulassen ist eine Veränderung der Angabe.
  Nur wenn im Diktat keine Einheit genannt wurde, bleibt die bloße Stärke
  stehen, wie er sie auch im Abschnitt "Aktuelle Therapie" schreibt
  ("Jardiance 10", "Sevikar 40/5").
- Datumsangaben so, wie er sie verwendet: "8/25" oder "Mai/26" für Monat/Jahr,
  "27.10." für ein Datum im laufenden Jahr, "28.12.2023" für ein weiter
  zurückliegendes Ereignis. Übernehmen Sie das Format aus der Quelle.`;

export const BEURTEILUNG_TAG = 'beurteilung';
export const BEURTEILUNG_TITEL_TAG = 'beurteilung_titel';

export interface BeurteilungPromptInput {
  transcript: string;
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

WAS DIKTIERT WURDE
In den allermeisten Fällen diktiert der Arzt eine Zusammenfassende
Beurteilung: er fasst einen Patientenfall zusammen, ordnet Befunde ein und
spricht Empfehlungen aus. Dann tragen Sie im Titel-Block genau
"Zusammenfassende Beurteilung" ein.

Manchmal diktiert er aber etwas anderes — eine Notiz an sich selbst, einen
einzelnen Befund, einen Brieftext, eine Liste. Dann geben Sie im Titel-Block
eine kurze, sachliche deutsche Überschrift an, die benennt, was es
tatsächlich ist ("Notiz", "Befund", "Anamnese", "Telefonat", ...). Setzen Sie
"Zusammenfassende Beurteilung" NICHT über etwas, das keine ist: die
Überschrift steht am Ende in seinem Brief, und eine falsche Überschrift ist
eine falsche Angabe wie jede andere.

Der Aufbau bleibt in beiden Fällen gleich.

AUFBAU DES ABSCHNITTS
Der Abschnitt besteht aus längeren Aufzählungspunkten, jeweils mit "- "
beginnend. Ein Punkt pro Gedanke, in der Reihenfolge, in der der Arzt sie
genannt hat. Vollständige Sätze, kein Telegrammstil.

${HJ_STYLE}

${glossaryBlock(glossary)}

${shots}

AUSGABEFORMAT
Antworten Sie ausschließlich in genau dieser Form, ohne Text davor oder
danach:

<${BEURTEILUNG_TITEL_TAG}>Zusammenfassende Beurteilung</${BEURTEILUNG_TITEL_TAG}>
<${BEURTEILUNG_TAG}>
- Erster Punkt ...
- Zweiter Punkt ...
</${BEURTEILUNG_TAG}>`;
}

/** The half that changes per patient — never cached. */
export function buildUserPrompt(input: Pick<BeurteilungPromptInput, 'transcript'>): string {
  return `DIKTAT (automatische Spracherkennung, kann Erkennungsfehler enthalten):

${input.transcript.trim()}

Erstellen Sie daraus den Abschnitt und benennen Sie ihn.`;
}

export const BEURTEILUNG_PROMPT_VERSION = PROMPT_VERSION;

/**
 * Pull the section out of the model's response.
 *
 * Deliberately forgiving: a draft the doctor can edit beats an exception. If
 * the tag is missing we return the whole response and flag it, rather than
 * losing work that is probably fine.
 */
export function parseBeurteilung(raw: string): {
  heading: string | null;
  text: string;
  wellFormed: boolean;
} {
  const titleMatch = raw.match(
    new RegExp(`<${BEURTEILUNG_TITEL_TAG}>([\\s\\S]*?)</${BEURTEILUNG_TITEL_TAG}>`, 'i'),
  );
  const heading = titleMatch?.[1]?.trim() ? titleMatch[1].trim() : null;

  const match = raw.match(
    new RegExp(`<${BEURTEILUNG_TAG}>([\\s\\S]*?)</${BEURTEILUNG_TAG}>`, 'i'),
  );
  if (match?.[1]) return { heading, text: match[1].trim(), wellFormed: true };

  // Unclosed tag — take everything after it.
  const open = raw.match(new RegExp(`<${BEURTEILUNG_TAG}>([\\s\\S]*)`, 'i'));
  if (open?.[1]) return { heading, text: open[1].trim(), wellFormed: false };

  // No tags at all: strip a title remnant so it cannot land in the letter.
  const withoutTitle = titleMatch ? raw.replace(titleMatch[0], '') : raw;
  return { heading, text: withoutTitle.trim(), wellFormed: false };
}

