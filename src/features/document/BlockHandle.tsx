import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The margin handle: hovering a block floats a "+" beside it. Pressing it
 * starts a dictation whose result is inserted AFTER that block — the
 * position is captured at click time; the caller keeps it honest against
 * concurrent edits via ProseMirror's transaction mapping.
 */
export function BlockHandle({
  editor,
  onDictate,
}: {
  editor: Editor;
  onDictate: (insertPos: number) => void;
}) {
  const hovered = useRef<{ pos: number; size: number } | null>(null);

  return (
    <DragHandle
      editor={editor}
      onNodeChange={({ node, pos }) => {
        if (node && pos >= 0) hovered.current = { pos, size: node.nodeSize };
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abschnitt diktieren"
        title="Abschnitt diktieren — Diktat wird hier eingefügt"
        className="size-10 text-muted-foreground hover:text-foreground"
        // The editor's selection must survive the click — without this the
        // mousedown blurs the editor before the click handler runs.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const h = hovered.current;
          if (h) onDictate(h.pos + h.size);
        }}
      >
        <Plus aria-hidden />
      </Button>
    </DragHandle>
  );
}
