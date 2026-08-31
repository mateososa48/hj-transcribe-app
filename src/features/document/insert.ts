/**
 * Text -> TipTap JSON, pure and node-testable. This is the counterpart of
 * bulletsToHtml in src/lib/format.ts: the same "- "/"• " line grammar, but
 * emitting editor nodes instead of markup. Nothing is ever dropped — prose
 * outside items becomes paragraphs (the lesson bulletsToHtml learned).
 */

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

const text = (t: string): TiptapNode => ({ type: 'text', text: t });
const paragraph = (t?: string): TiptapNode =>
  t ? { type: 'paragraph', content: [text(t)] } : { type: 'paragraph' };
const listItem = (t: string, nested?: TiptapNode): TiptapNode => ({
  type: 'listItem',
  content: nested ? [paragraph(t), nested] : [paragraph(t)],
});

/** Bullet lines -> block nodes: bulletLists with one nesting level, prose as paragraphs. */
export function bulletsToTiptap(input: string): TiptapNode[] {
  const blocks: TiptapNode[] = [];
  let items: TiptapNode[] = [];

  const flush = () => {
    if (items.length) {
      blocks.push({ type: 'bulletList', content: items });
      items = [];
    }
  };

  for (const raw of input.split('\n')) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)[•-]\s+(.*)$/);
    if (!m) {
      const line = raw.trim();
      const last = items[items.length - 1];
      if (last) {
        // Continuation of the previous item, hand-wrapped.
        const p = last.content?.[0];
        const t = p?.content?.[0];
        if (t?.text) t.text += ' ' + line;
      } else {
        flush();
        blocks.push(paragraph(line));
      }
      continue;
    }
    const nested = (m[1] ?? '').length >= 2;
    const content = (m[2] ?? '').trim();
    if (!content) continue;
    if (nested && items.length) {
      const parent = items[items.length - 1]!;
      const existing = parent.content?.find((c) => c.type === 'bulletList');
      if (existing) existing.content!.push(listItem(content));
      else parent.content!.push({ type: 'bulletList', content: [listItem(content)] });
    } else {
      items.push(listItem(content));
    }
  }
  flush();
  return blocks.length ? blocks : [paragraph()];
}

/**
 * One stored section -> block nodes, honouring each section's shape:
 * Medikation keeps its literal tab characters (one paragraph per line, tabs
 * intact — the columns depend on them), Anamnese is prose, list sections
 * become real bullet lists.
 */
export function sectionToTiptap(sectionKey: string, value: string): TiptapNode[] {
  if (sectionKey === 'medikation') {
    const lines = value.split('\n').filter((l) => l.trim());
    return lines.length ? lines.map((l) => paragraph(l.replace(/^\s*[•-]\s+/, ''))) : [paragraph()];
  }
  if (/^\s*[•-]\s/m.test(value)) return bulletsToTiptap(value);
  const lines = value.split('\n').filter((l) => l.trim());
  return lines.length ? lines.map((l) => paragraph(l.trim())) : [paragraph()];
}

/** A dictated Abschnitt -> optional heading + its bullets. */
export function abschnittToNodes(heading: string | null, value: string): TiptapNode[] {
  const body = bulletsToTiptap(value);
  if (!heading) return body;
  return [
    { type: 'heading', attrs: { level: 2 }, content: [text(heading)] },
    ...body,
  ];
}

/**
 * His canonical section names, and the aliases that must land on them —
 * the vocabulary glue that keeps one letter from growing two "Diagnosen".
 * Titles that match nothing stay themselves (a new, freely named section).
 */
export const CANONICAL_SECTIONS = [
  'Diagnosen',
  'Anamnese',
  'Befunde',
  'Zusammenfassende Beurteilung',
  'Aktuelle Therapie',
] as const;

const SECTION_ALIASES: Record<string, string> = {
  diagnosen: 'Diagnosen',
  diagnose: 'Diagnosen',
  anamnese: 'Anamnese',
  vorgeschichte: 'Anamnese',
  befunde: 'Befunde',
  befund: 'Befunde',
  messwerte: 'Befunde',
  werte: 'Befunde',
  beurteilung: 'Zusammenfassende Beurteilung',
  'zusammenfassende beurteilung': 'Zusammenfassende Beurteilung',
  // A Termin's notes call this "Zusammenfassung". Without the alias it landed
  // as a brand-new heading at the very END of the letter, under Aktuelle
  // Therapie — the summary of the appointment filed after the medication.
  zusammenfassung: 'Zusammenfassende Beurteilung',
  medikation: 'Aktuelle Therapie',
  therapie: 'Aktuelle Therapie',
  'aktuelle therapie': 'Aktuelle Therapie',
  'aktuelle medikation': 'Aktuelle Therapie',
};

/** "Medikation" -> "Aktuelle Therapie"; unknown titles pass through trimmed. */
export function canonicalSectionTitle(title: string): string {
  const key = title.trim().toLowerCase().replace(/[.:]+$/, '');
  return SECTION_ALIASES[key] ?? title.trim();
}

/** All the text a node carries, however deeply it is nested. */
function textOf(node: TiptapNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(textOf).join('');
}

/**
 * The Kopf every one of his letters opens with — but only as far as it is the
 * SAME in every one: the city, the "An" label, and the salutation he has used
 * for decades. Everything that differs per letter (the referring practice, the
 * patient, the date) is a blank line he fills. A placeholder name we invented
 * would be a fact in a letter he signs.
 *
 * `null` is a blank line.
 */
export const BERICHT_KOPF: ReadonlyArray<string | null> = [
  'Mainz,',
  null,
  'An',
  null,
  'Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege,',
  'ich darf nachfolgend über die letzten Untersuchungen, Herrn/Frau … betreffend, zusammenfassend berichten.',
];

/**
 * The sections a NEW Bericht starts with — his real letters' shape, which is
 * not the same list as CANONICAL_SECTIONS above. That one is the vocabulary a
 * dictation may land on and keeps every name he might say; this one is only
 * what a blank letter comes with, and an empty heading he never fills is a
 * heading he has to delete.
 */
export const BERICHT_TEMPLATE_SECTIONS = [
  'Diagnosen',
  'Anamnese',
  'Zusammenfassende Beurteilung',
  'Aktuelle Therapie',
] as const;

/** A blank Bericht, as both the editor and the untouched-check see it. */
export function berichtTemplateDoc(): { type: 'doc'; content: TiptapNode[] } {
  const content: TiptapNode[] = BERICHT_KOPF.map((line) =>
    line ? paragraph(line) : paragraph(),
  );
  for (const title of BERICHT_TEMPLATE_SECTIONS) {
    content.push({ type: 'heading', attrs: { level: 2 }, content: [text(title)] });
    content.push(paragraph());
  }
  return { type: 'doc', content };
}

interface Block {
  type: string;
  text: string;
}

/**
 * A document reduced to what was actually written in it: headings with their
 * titles, paragraphs that carry text, and nothing else. Blank lines drop out,
 * so any number of them still reads as untouched. Null when a block appears
 * that the template never contains — a list, a table — because he put it there.
 */
function writtenBlocks(doc: unknown): Block[] | null {
  const root = doc as { type?: string; content?: TiptapNode[] } | null;
  if (!root || root.type !== 'doc') return null;

  const blocks: Block[] = [];
  for (const block of root.content ?? []) {
    const value = textOf(block).trim();
    if (block.type === 'paragraph') {
      if (value) blocks.push({ type: 'paragraph', text: value });
      continue;
    }
    if (block.type === 'heading') {
      blocks.push({ type: 'heading', text: value });
      continue;
    }
    return null;
  }
  return blocks;
}

/**
 * True when a Bericht's body is still exactly the template it was created
 * with: the Kopf boilerplate, his section headings, and nothing written
 * anywhere between them.
 *
 * Compared against the template's own shape rather than a hardcoded list, so
 * changing what a new Bericht comes with cannot quietly break the check that
 * decides whether an unused one may be thrown away. Structural rather than a
 * JSON equality test, because the editor normalises what it loads and
 * attributes appear that were never written.
 */
export function isTemplateBody(doc: unknown): boolean {
  const actual = writtenBlocks(doc);
  if (!actual) return false;
  const expected = writtenBlocks(berichtTemplateDoc());
  if (!expected || actual.length !== expected.length) return false;
  return actual.every(
    (block, i) => block.type === expected[i]!.type && block.text === expected[i]!.text,
  );
}
