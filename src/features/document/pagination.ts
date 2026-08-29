import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Page breaks that fall BETWEEN blocks.
 *
 * The sheet measures where each paragraph, heading and bullet lands and asks
 * for the ones that would be sliced by a page edge to be pushed onto the next
 * page. The push has to be a ProseMirror decoration rather than a style we set
 * ourselves: ProseMirror owns this DOM and strips attributes it did not put
 * there — inline styles silently vanish on the next transaction.
 */
export type PagePush = { pos: number; px: number };

const pagePushKey = new PluginKey<DecorationSet>('pagePush');

export const PagePushes = Extension.create({
  name: 'pagePushes',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pagePushKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const pushes = tr.getMeta(pagePushKey) as PagePush[] | undefined;
            if (!pushes) return value.map(tr.mapping, tr.doc);
            const decorations = pushes.flatMap((push) => {
              const node = tr.doc.nodeAt(push.pos);
              if (!node) return [];
              return [
                Decoration.node(push.pos, push.pos + node.nodeSize, {
                  style: `padding-top:${push.px}px`,
                }),
              ];
            });
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations: (state) => pagePushKey.getState(state),
        },
      }),
    ];
  },
});

/** Replaces the whole set of pushes. Never enters the undo history. */
export function applyPagePushes(editor: Editor, pushes: PagePush[]): void {
  const { state, view } = editor;
  view.dispatch(state.tr.setMeta(pagePushKey, pushes).setMeta('addToHistory', false));
}

/**
 * The blocks a page edge may not cut through, in document order — with list
 * items counted one by one, since a Befunde list is a single block far taller
 * than any page.
 */
export function collectAtoms(view: EditorView): Array<{ pos: number; dom: HTMLElement }> {
  const atoms: Array<{ pos: number; dom: HTMLElement }> = [];
  view.state.doc.forEach((node, offset) => {
    const isList = node.type.name === 'bulletList' || node.type.name === 'orderedList';
    if (isList) {
      node.forEach((_item, itemOffset) => {
        const pos = offset + 1 + itemOffset;
        const dom = view.nodeDOM(pos);
        if (dom instanceof HTMLElement) atoms.push({ pos, dom });
      });
    } else {
      const dom = view.nodeDOM(offset);
      if (dom instanceof HTMLElement) atoms.push({ pos: offset, dom });
    }
  });
  return atoms;
}
