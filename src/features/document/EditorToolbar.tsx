import { useCallback, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Check,
  ClipboardCopy,
  FileDown,
  Import,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { exportDocx } from './export-docx';

/**
 * The instrument row above the sheet — the handful of formatting moves his
 * letters actually use, on the app's own keys. Everything else Word does is
 * deliberately absent: fewer, larger, clearer.
 */
export function EditorToolbar({
  editor,
  documentTitle,
  onImport,
}: {
  editor: Editor;
  documentTitle: string;
  onImport: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      heading1: editor.isActive('heading', { level: 1 }),
      heading2: editor.isActive('heading', { level: 2 }),
      heading3: editor.isActive('heading', { level: 3 }),
      fontSize: (editor.getAttributes('textStyle').fontSize as string | undefined) ?? 'normal',
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const block = state.heading1
    ? 'h1'
    : state.heading2
      ? 'h2'
      : state.heading3
        ? 'h3'
        : 'text';

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([editor.getHTML()], { type: 'text/html' }),
          // The plain flavour carries literal tabs byte-exact — the flavour
          // his Word tab stops depend on for the Medikation columns.
          'text/plain': new Blob([editor.getText({ blockSeparator: '\n' })], {
            type: 'text/plain',
          }),
        }),
      ]);
    } catch {
      toast.error('Kopieren war nicht möglich. Bitte markieren Sie den Text und drücken Strg+C.');
      return;
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  }, [editor]);

  const toggle = (label: string, active: boolean, icon: React.ReactNode, run: () => void) => (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      onClick={run}
      className={cn('size-10', active && 'bg-muted text-foreground')}
    >
      {icon}
    </Button>
  );

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/95 px-2 py-1.5 backdrop-blur-sm">
      <Select
        value={block}
        onValueChange={(v) => {
          if (!v) return;
          const chain = editor.chain().focus();
          if (v === 'text') chain.setParagraph().run();
          else chain.toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
      >
        <SelectTrigger aria-label="Absatzformat" className="h-10 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Text</SelectItem>
          <SelectItem value="h1">Überschrift 1</SelectItem>
          <SelectItem value="h2">Überschrift 2</SelectItem>
          <SelectItem value="h3">Überschrift 3</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={state.fontSize}
        onValueChange={(v) => {
          if (!v) return;
          const chain = editor.chain().focus();
          if (v === 'normal') chain.unsetFontSize().run();
          else chain.setFontSize(v).run();
        }}
      >
        <SelectTrigger aria-label="Schriftgröße" className="h-10 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="1.25rem">Groß</SelectItem>
          <SelectItem value="1.5rem">Sehr groß</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {toggle('Fett', state.bold, <Bold aria-hidden />, () =>
        editor.chain().focus().toggleBold().run(),
      )}
      {toggle('Kursiv', state.italic, <Italic aria-hidden />, () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      {toggle('Unterstrichen', state.underline, <Underline aria-hidden />, () =>
        editor.chain().focus().toggleUnderline().run(),
      )}

      <Separator orientation="vertical" className="mx-1 h-6" />

      {toggle('Aufzählung', state.bulletList, <List aria-hidden />, () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {toggle('Nummerierte Liste', state.orderedList, <ListOrdered aria-hidden />, () =>
        editor.chain().focus().toggleOrderedList().run(),
      )}

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        variant="ghost"
        size="icon"
        aria-label="Rückgängig"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
        className="size-10"
      >
        <Undo2 aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Wiederherstellen"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
        className="size-10"
      >
        <Redo2 aria-hidden />
      </Button>

      <div className="ms-auto flex items-center gap-2">
        <Button variant="outline" onClick={onImport}>
          <Import aria-hidden />
          Einfügen
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await exportDocx(editor.getJSON(), documentTitle);
              toast.success('Word-Datei gespeichert.');
            } catch {
              toast.error('Die Word-Datei konnte nicht erstellt werden.');
            }
          }}
        >
          <FileDown aria-hidden />
          Word-Datei
        </Button>
        <Button
          variant={copied ? 'secondary' : 'default'}
          onClick={() => void copyAll()}
          className="rounded-full"
        >
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
    </div>
  );
}
