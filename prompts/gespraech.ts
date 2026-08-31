import { CORE_RULES, PROMPT_VERSION } from './rules.ts';

/**
 * The appointment feature: one recorded consultation in, meeting notes out.
 *
 * It used to demand four fixed blocks — Zusammenfassung, Diagnosen, Anamnese,
 * Medikation — on every recording, whatever the appointment was about. A
 * five-minute follow-up came back wearing the same four headings as a first
 * consultation, three of them thin or empty, and the shape said more about the
 * template than about the patient.
 *
 * So the sections are the conversation's now. The model writes as many as the
 * appointment supports and no more, names each one, and puts nothing under a
 * heading the conversation did not fill. A section that has nothing in it is
 * not an empty section: it is a section that does not exist.
 *
 * Bullets are the default form throughout, because that is how his notes and
 * his letters are written — prose only where a bullet would break a thought
 * that belongs together (an Anamnese paragraph, a negation list).
 *
 * One call, not several: the model has to see the whole conversation to know
 * that a drug mentioned in passing belongs with the medication.
 */

/**
 * The four keys the FIRST version produced. Results drafted before the free
 * form exist in his database and still have to render, so their keys and
 * labels stay here — nothing new is written under them.
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
 * How to write, not what to write. The headings are examples of the kind of
 * thing a consultation yields — never a list to be filled in.
 */
export const SECTION_GUIDE = `WIE DIE NOTIZEN AUFGEBAUT SIND

Sie bestimmen die Abschnitte selbst, aus dem Gespräch heraus. Es gibt keine
vorgegebene Liste, die abgearbeitet wird.

- So viele Abschnitte, wie das Gespräch hergibt, und keinen mehr. Eine kurze
  Verlaufskontrolle ergibt zwei oder drei; eine Erstvorstellung ergibt mehr.
- Ein Abschnitt entsteht NUR, wenn im Gespräch etwas dazu gesagt wurde. Ein
  Thema, das nicht vorkam, bekommt keine Überschrift — auch keine leere, auch
  keinen Hinweis, dass dazu nichts gesagt wurde.
- Überschriften sind kurz und sagen, was darunter steht: "Anlass",
  "Beschwerden", "Diagnosen", "Vorgeschichte", "Medikation", "Untersuchung",
  "Besprochen", "Weiteres Vorgehen". Das sind Beispiele, keine Vorgabe.
- Die Notizen sind so lang wie der Termin. Ein zwanzigminütiges Gespräch
  ergibt ausführliche Notizen; nichts wird gekürzt, was gesagt wurde.

FORM

- Aufzählungspunkte sind die Regel. Jeder Punkt beginnt mit "- ", ein Gedanke
  pro Punkt. Untergeordnetes wird eingerückt:
      - Koronare Herzkrankheit mit
        - Z.n. Vorderwandinfarkt 11/22
- Fließtext nur, wo eine Aufzählung einen Zusammenhang zerreißen würde — etwa
  eine Anamnese, die als Verlauf erzählt wird, oder eine Reihe von
  Verneinungen: "Luftnot, Palpitationen, Schwindel und Beinödeme werden
  verneint."
- Medikamente, wo sie vorkommen, sind KEINE Aufzählungspunkte: kein "- " davor.
  Präparatename und Stärke OHNE Einheit, dann ein TABULATOR, dann das Schema,
  ein Präparat pro Zeile:
      ASS 100	1-0-0
      Clopidogrel 75	1-0-0 bis 5/26
  "ASS hundert" wird zu "ASS 100", niemals zu "ASS 100 mg". Fehlt das Schema,
  steht die Zeile ohne Schema da. Jedes Präparat erscheint genau einmal und
  nur in seiner endgültigen Fassung.
- Zeitangaben knapp: "11/22", "2019".`;

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
TRANSKRIPT EINES SPRECHSTUNDENGESPRÄCHS, nach Sprechern getrennt, und schreiben
daraus die Notizen zu diesem Termin — eine Zusammenfassung des Gesprächs, in
Abschnitten. Der Arzt liest und korrigiert alles selbst; das Transkript und die
Tonaufnahme liegen ihm daneben vor.

Wer von den Sprechern der Arzt ist, erkennen Sie am Gesprächsverlauf, falls die
Sprecher nicht benannt sind.

${CORE_RULES}

${guide}

WAS NICHT IN DIE NOTIZEN GEHÖRT
- Messwerte aus Echokardiographie, EKG, Belastungstest oder Labor, die erst
  nach dem Gespräch erhoben werden. Was im Gespräch darüber angekündigt wird,
  ist kein Befund.
- Ihre eigene Einschätzung oder Empfehlung. Die Beurteilung diktiert der Arzt
  selbst.
${glossaryBlock}
AUSGABEFORMAT

Geben Sie einen Block je Abschnitt aus, in der Reihenfolge, in der die Notizen
gelesen werden sollen, und nichts außerhalb dieser Blöcke:

<abschnitt titel="Anlass">
- …
</abschnitt>
<abschnitt titel="Beschwerden">
- …
</abschnitt>

Die Titel wählen Sie. Kein Block ohne Inhalt, kein Block für ein Thema, das im
Gespräch nicht vorkam.`;
}

/** The half that changes per patient — never cached. */
export function buildGespraechUserPrompt(input: GespraechPromptInput): string {
  return `TRANSKRIPT DES GESPRÄCHS (automatische Spracherkennung, kann Erkennungsfehler enthalten):

${input.transcript.trim()}

Schreiben Sie daraus die Notizen zu diesem Termin.`;
}

/**
 * The shared safety rules are unchanged, so PROMPT_VERSION stands; this
 * prompt's own shape changed completely, and a result has to be traceable to
 * the contract that produced it — hence the suffix.
 */
export const GESPRAECH_PROMPT_VERSION = `${PROMPT_VERSION}/abschnitte-2026-08-30`;

/**
 * A heading becomes a storage key: lower case, umlauts folded, everything else
 * a hyphen. Collisions get a suffix so two sections can never overwrite each
 * other — the doctor's text is never silently replaced by another section's.
 */
export function sectionKeyOf(title: string, taken: Set<string> = new Set()): string {
  const base =
    title
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'abschnitt';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export interface ParsedGespraech {
  /** Section text by key, in reading order. */
  sections: Record<string, string>;
  /** The order the model asked for — object key order is not a contract. */
  order: string[];
  /** The headings it chose, by key. */
  labels: Record<string, string>;
  wellFormed: boolean;
}

/**
 * Pull the sections out of the response.
 *
 * Forgiving on purpose: a block whose closing tag never arrived is still worth
 * showing, and a response that came back as the OLD four fixed tags still
 * parses — that path stays until no such result is being drafted anywhere.
 * `wellFormed` is false whenever anything had to be recovered.
 */
export function parseGespraech(raw: string): ParsedGespraech {
  const sections: Record<string, string> = {};
  const order: string[] = [];
  const labels: Record<string, string> = {};
  const taken = new Set<string>();
  let wellFormed = true;

  const add = (title: string, body: string) => {
    const text = body.trim();
    // A heading with nothing under it is not a section.
    if (!text) return;
    const key = sectionKeyOf(title, taken);
    taken.add(key);
    sections[key] = text;
    labels[key] = title.trim() || key;
    order.push(key);
  };

  const blocks = [
    ...raw.matchAll(/<abschnitt\s+titel\s*=\s*"([^"]*)"\s*>([\s\S]*?)<\/abschnitt>/gi),
  ];
  for (const block of blocks) add(block[1] ?? '', block[2] ?? '');

  // An unterminated final block: take everything after it.
  const dangling = raw.match(
    /<abschnitt\s+titel\s*=\s*"([^"]*)"\s*>((?:(?!<abschnitt)[\s\S])*)$/i,
  );
  if (dangling && !/<\/abschnitt>\s*$/i.test(raw)) {
    add(dangling[1] ?? '', (dangling[2] ?? '').replace(/<\/?\w+>\s*$/, ''));
    wellFormed = false;
  }

  if (order.length > 0) return { sections, order, labels, wellFormed };

  // Nothing in the new shape — try the four fixed tags the first version used.
  for (const key of GESPRAECH_SECTIONS) {
    const closed = raw.match(new RegExp(`<${key}>([\\s\\S]*?)</${key}>`, 'i'));
    const open =
      closed ??
      raw.match(
        new RegExp(`<${key}>([\\s\\S]*?)(?=<(?:${GESPRAECH_SECTIONS.join('|')})>|$)`, 'i'),
      );
    if (!closed) wellFormed = false;
    const text = (open?.[1] ?? '').replace(/<\/?\w+>\s*$/, '').trim();
    if (!text) continue;
    sections[key] = text;
    labels[key] = GESPRAECH_SECTION_LABELS[key];
    order.push(key);
  }

  if (order.length === 0) wellFormed = false;
  return { sections, order, labels, wellFormed };
}
