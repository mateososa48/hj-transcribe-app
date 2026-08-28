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
