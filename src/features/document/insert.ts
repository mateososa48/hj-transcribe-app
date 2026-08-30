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
 * True when a Bericht's body is still exactly the template it was created
 * with: his five section headings, and nothing written anywhere between them.
 *
 * Structural rather than a comparison against a rebuilt template, because the
 * editor normalises what it loads — attributes appear that were never written
 * — and a JSON equality check would call an untouched letter modified.
 */
export function isTemplateBody(doc: unknown): boolean {
  const root = doc as { type?: string; content?: TiptapNode[] } | null;
  if (!root || root.type !== 'doc') return false;

  let matched = 0;
  for (const block of root.content ?? []) {
    if (block.type === 'paragraph') {
      // Empty lines are untouched, however many of them he made.
      if (textOf(block).trim()) return false;
      continue;
    }
    if (block.type !== 'heading') return false;
    if (textOf(block).trim() !== CANONICAL_SECTIONS[matched]) return false;
    matched++;
  }
  return matched === CANONICAL_SECTIONS.length;
}
