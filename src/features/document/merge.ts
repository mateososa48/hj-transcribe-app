import type { Editor } from '@tiptap/react';

import { canonicalSectionTitle, type TiptapNode } from './insert';

/**
 * Section-aware insertion: content that names a section his letter already
 * has fills THAT section instead of stamping a second heading — the
 * difference between assembling a letter and collecting scraps.
 */

interface SectionRange {
  /** Position right after the heading node. */
  contentFrom: number;
  /** Position before the next heading (or document end). */
  contentTo: number;
  /** True when the section holds nothing but one empty paragraph. */
  isEmpty: boolean;
  emptyFrom: number;
  emptyTo: number;
}

/** Find a top-level section by its (canonicalized) heading text. */
function findSection(editor: Editor, title: string): SectionRange | null {
  const wanted = canonicalSectionTitle(title).toLowerCase();
  const doc = editor.state.doc;
  let range: SectionRange | null = null;
  let inSection = false;
  let sawContent = false;
  let onlyChild: { from: number; to: number; empty: boolean } | null = null;

  doc.forEach((node, offset) => {
    const pos = offset;
    if (node.type.name === 'heading') {
      if (inSection && range) {
        range.contentTo = pos;
        inSection = false;
      }
      if (canonicalSectionTitle(node.textContent).toLowerCase() === wanted && !range) {
        range = {
          contentFrom: pos + node.nodeSize,
          contentTo: doc.content.size,
          isEmpty: false,
          emptyFrom: 0,
          emptyTo: 0,
        };
        inSection = true;
        sawContent = false;
        onlyChild = null;
      }
      return;
    }
    if (inSection && range) {
      if (!sawContent) {
        onlyChild = {
          from: pos,
          to: pos + node.nodeSize,
          empty: node.type.name === 'paragraph' && node.content.size === 0,
        };
      } else {
        onlyChild = null;
      }
      sawContent = true;
    }
  });

  if (range && onlyChild) {
    const r = range as SectionRange;
    const c = onlyChild as { from: number; to: number; empty: boolean };
    if (c.empty && r.contentTo === c.to) {
      r.isEmpty = true;
      r.emptyFrom = c.from;
      r.emptyTo = c.to;
    }
  }
  return range;
}

/**
 * Insert one titled block of content: into the matching section when the
 * letter has one (replacing its empty placeholder paragraph, or appending
 * at the section's end), as a fresh heading + content at the document end
 * otherwise. Returns without a heading when it merged.
 */
export function insertTitledContent(editor: Editor, title: string, nodes: TiptapNode[]): void {
  const section = findSection(editor, title);
  if (section) {
    if (section.isEmpty) {
      editor.commands.insertContentAt(
        { from: section.emptyFrom, to: section.emptyTo },
        nodes as never,
        { updateSelection: false },
      );
    } else {
      editor.commands.insertContentAt(section.contentTo, nodes as never, {
        updateSelection: false,
      });
    }
    return;
  }
  const heading: TiptapNode = {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: canonicalSectionTitle(title) }],
  };
  editor.commands.insertContentAt(editor.state.doc.content.size, [heading, ...nodes] as never, {
    updateSelection: false,
  });
}
