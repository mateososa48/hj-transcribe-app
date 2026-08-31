import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * The invitation to dictate, sitting in the empty line under each section
 * heading — where the words are going to land.
 *
 * It replaces the hover-only "+" in the margin. That handle asked him to
 * discover it by moving the mouse to the right place, then to know what a
 * bare plus meant, and it pointed at a BLOCK, which is not how he thinks
 * about a letter. This one is always visible, says what it does, and belongs
 * unmistakably to the section it sits in.
 *
 * It used to leave as soon as a section had text, on the theory that a written
 * letter should be a page of writing and nothing else. But a section is rarely
 * finished in one dictation — he adds to Diagnosen, then adds again — and the
 * key vanishing after the first one meant the second had to be aimed from the
 * toolbar menu instead. So every section keeps its invitation, sitting under
 * whatever it already says.
 */
export interface SectionInviteOptions {
  /** Receives the heading the invite sits under. */
  onDictate: (title: string) => void;
  label: string;
}

const MIC_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
  '<rect x="9" y="2" width="6" height="13" rx="3"/></svg>';

export const SectionInvite = Extension.create<SectionInviteOptions>({
  name: 'sectionInvite',

  addOptions() {
    return { onDictate: () => {}, label: 'Diktieren' };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey('sectionInvite'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let heading: string | null = null;
            /**
             * Where the invitation goes: after the last thing the section
             * actually says. Trailing blank lines do not move it, so an empty
             * section keeps the key tucked under its heading instead of
             * pushing it down a line the letter does not use yet.
             */
            let anchor = 0;

            const place = () => {
              if (!heading) return;
              const title = heading;
              decorations.push(
                Decoration.widget(
                  anchor,
                  () => {
                      const button = document.createElement('button');
                      button.type = 'button';
                      button.className = 'section-invite';
                      button.contentEditable = 'false';
                      button.innerHTML = `${MIC_ICON}<span>${options.label}</span>`;
                      button.title = `In „${title}" diktieren`;
                      button.setAttribute('aria-label', `In „${title}" diktieren`);
                      // The caret must not move to the widget on press.
                      button.addEventListener('mousedown', (event) => event.preventDefault());
                      button.addEventListener('click', (event) => {
                        event.preventDefault();
                        options.onDictate(title);
                      });
                    return button;
                  },
                  { side: 1 },
                ),
              );
              heading = null;
            };

            state.doc.forEach((node, offset) => {
              if (node.type.name === 'heading') {
                place();
                heading = node.textContent.trim() || null;
                anchor = offset + node.nodeSize;
                return;
              }
              if (!heading) return;
              const empty = node.type.name === 'paragraph' && node.content.size === 0;
              if (!empty) anchor = offset + node.nodeSize;
            });
            place();

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/** The letter's own section headings, in document order — the dictation targets. */
export function documentSections(doc: {
  forEach: (fn: (node: { type: { name: string }; textContent: string }) => void) => void;
}): string[] {
  const titles: string[] = [];
  doc.forEach((node) => {
    if (node.type.name !== 'heading') return;
    const title = node.textContent.trim();
    if (title && !titles.includes(title)) titles.push(title);
  });
  return titles;
}
