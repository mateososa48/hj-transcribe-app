import type { TiptapNode } from './insert.ts';

/**
 * The letter's words, out and back in — without its structure ever leaving.
 *
 * Translation walks the stored TipTap document and lifts out one segment per
 * BLOCK that carries text: a heading, a paragraph, the paragraph inside a
 * bullet. The model sees a numbered list of those and nothing else. When the
 * translation returns, each segment is written back into the block it came
 * from, in the same walk order.
 *
 * Two decisions are worth stating, because both were the other way first.
 *
 * A block, not a text node. A sentence split by a bold run is three text nodes
 * and one thought; handing the model "Der Blutdruck lag bei", "145/90" and
 * "mmHg" separately asks it to translate fragments and gets fragments back.
 * The cost is that a mark INSIDE a sentence does not survive into the
 * translated copy — the block keeps the marks of its first run. The German
 * original is a separate document and is never touched, so that cost is paid
 * once, in the copy, and never on his own letter.
 *
 * A missing segment keeps its German. The alternative — dropping it — slides
 * every following line up by one, and in a letter whose Medikation rows are
 * positional that is a hazard, not a blemish.
 */

/** Blocks in walk order, each with the text it carries. */
interface Holder {
  node: TiptapNode;
  text: string;
}

function isTextRun(node: TiptapNode): boolean {
  return node.type === 'text' && typeof node.text === 'string';
}

/**
 * Depth-first, document order. A node whose children include text runs is a
 * holder; every other node is walked through.
 */
function walk(node: TiptapNode, out: Holder[]): void {
  const children = node.content ?? [];
  const runs = children.filter(isTextRun);

  if (runs.length > 0) {
    const text = runs.map((r) => r.text ?? '').join('');
    // A block of nothing but whitespace has nothing to translate, and sending
    // it would only invite the model to fill it.
    if (text.trim()) out.push({ node, text });
  }

  for (const child of children) {
    if (isTextRun(child)) continue;
    walk(child, out);
  }
}

function holders(doc: unknown): Holder[] {
  const root = doc as TiptapNode | null;
  if (!root || typeof root !== 'object') return [];
  const out: Holder[] = [];
  walk(root, out);
  return out;
}

/** Every translatable run of the letter, in reading order. */
export function collectSegments(doc: unknown): string[] {
  return holders(doc).map((h) => h.text);
}

/**
 * Write the translation back into a COPY of the document.
 *
 * `translated` is positional: index i belongs to the segment collectSegments
 * returned at i. A null, an undefined or an empty string leaves that block in
 * German, which is why the count is asserted rather than trusted.
 */
export function applySegments(doc: unknown, translated: (string | null)[]): unknown {
  const copy = structuredClone(doc) as TiptapNode;
  const targets = holders(copy);

  targets.forEach((holder, i) => {
    const next = translated[i];
    if (typeof next !== 'string' || !next.trim()) return;

    const children = holder.node.content ?? [];
    const firstRun = children.find(isTextRun);
    const rest = children.filter((c) => !isTextRun(c));

    // The first run's marks carry the whole block: a fully bold paragraph
    // stays bold, and a sentence with one bold word inside it does not.
    const run: TiptapNode = { type: 'text', text: next };
    if (firstRun?.marks) run.marks = firstRun.marks;

    holder.node.content = [run, ...rest];
  });

  return copy;
}

/** How many blocks came back in German after all. */
export function untranslatedCount(translated: (string | null)[]): number {
  return translated.filter((t) => typeof t !== 'string' || !t.trim()).length;
}

/**
 * The copy's name. His own title with the language after it, so the two sit
 * together in the list and are told apart at a glance.
 */
export function translatedTitle(title: string, endonym: string): string {
  const base = title.trim() || 'Bericht';
  return `${base} (${endonym})`;
}
