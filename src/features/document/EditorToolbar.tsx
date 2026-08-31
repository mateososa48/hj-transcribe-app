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
  Mic,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { documentSections } from './section-invite';
import type { DictateTarget } from './dictate-target';

/**
 * The instrument row above the sheet — the handful of formatting moves his
 * letters actually use, on the app's own keys. Everything else Word does is
 * deliberately absent: fewer, larger, clearer.
 *
 * It is a STRIPE, not a box: it spans the whole working area edge to edge and
 * stays on exactly one line at every width. Nothing here may wrap — a toolbar
 * that reflows into two rows moves the keys out from under his hand.
 */
export function EditorToolbar({
  editor,
  documentTitle,
  recording,
  onImport,
  onDictate,
}: {
  editor: Editor;
  documentTitle: string;
  /** A recording window is open — there is only one microphone. */
  recording: boolean;
  onImport: () => void;
  onDictate: (target: DictateTarget) => void;
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
      // The letter's own headings are the dictation targets, named in his
      // vocabulary — not positions he has to aim at.
      sections: documentSections(editor.state.doc),
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

  /**
   * A short rule between groups. Not the Separator primitive: it sets
   * `self-stretch` on vertical, which stretched it to the full height of the
   * stripe — a full-height line reads as a column edge, not a group break.
   */
  const Divider = () => (
    <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 self-center rounded-full bg-border" />
  );

  const toggle = (label: string, active: boolean, icon: React.ReactNode, run: () => void) => (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={run}
      className={cn(
        'size-10 shrink-0 transition-[background-color,color,transform] duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.94]',
        active && 'bg-muted text-foreground',
      )}
    >
      {icon}
    </Button>
  );

  /**
   * The action keys. Their labels are the first thing to go as the window
   * narrows — the icon plus its tooltip keeps the row honest at one line
   * without ever hiding a control.
   */
  const action = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    variant: 'outline' | 'default' | 'secondary' = 'outline',
    extra?: string,
  ) => (
    <Button
      variant={variant}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn('shrink-0 px-3', extra)}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </Button>
  );

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="flex h-14 w-full flex-nowrap items-center gap-1 overflow-x-auto px-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Select
          value={block}
          onValueChange={(v) => {
            if (!v) return;
            const chain = editor.chain().focus();
            if (v === 'text') chain.setParagraph().run();
            else chain.toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
          }}
        >
          <SelectTrigger aria-label="Absatzformat" className="h-10 w-[8.5rem] shrink-0">
            <SelectValue>{block === 'text' ? 'Text' : `Überschrift ${block.slice(1)}`}</SelectValue>
          </SelectTrigger>
          {/* Anchored under the trigger, not over it: Base UI's item-aligned
              mode disables the open animation entirely, and this control is
              meant to READ as a dropdown — it grows out of its own key. */}
          <SelectContent alignItemWithTrigger={false} align="start">
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
          <SelectTrigger aria-label="Schriftgröße" className="h-10 w-[7rem] shrink-0">
            <SelectValue>
              {state.fontSize === 'normal'
                ? 'Normal'
                : state.fontSize === '1.25rem'
                  ? 'Groß'
                  : 'Sehr groß'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="1.25rem">Groß</SelectItem>
            <SelectItem value="1.5rem">Sehr groß</SelectItem>
          </SelectContent>
        </Select>

        <Divider />

        {toggle('Fett', state.bold, <Bold aria-hidden />, () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {toggle('Kursiv', state.italic, <Italic aria-hidden />, () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {toggle('Unterstrichen', state.underline, <Underline aria-hidden />, () =>
          editor.chain().focus().toggleUnderline().run(),
        )}

        <Divider />

        {toggle('Aufzählung', state.bulletList, <List aria-hidden />, () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {toggle('Nummerierte Liste', state.orderedList, <ListOrdered aria-hidden />, () =>
          editor.chain().focus().toggleOrderedList().run(),
        )}

        <Divider />

        <Button
          variant="ghost"
          size="icon"
          aria-label="Rückgängig"
          title="Rückgängig"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
          className="size-10 shrink-0 transition-transform duration-[150ms] active:scale-[0.94]"
        >
          <Undo2 aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Wiederherstellen"
          title="Wiederherstellen"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
          className="size-10 shrink-0 transition-transform duration-[150ms] active:scale-[0.94]"
        >
          <Redo2 aria-hidden />
        </Button>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 ps-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  title="Diktieren"
                  disabled={recording}
                  className="shrink-0 px-3"
                >
                  <Mic aria-hidden />
                  <span className="hidden xl:inline">Diktieren</span>
                </Button>
              }
            />
            {/* Where the dictation goes is chosen BY NAME, before he speaks —
                the one thing a dictation into a letter must never leave in
                doubt. */}
            <DropdownMenuContent align="end" className="min-w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Wohin soll das Diktat?</DropdownMenuLabel>
                {state.sections.map((title) => (
                  <DropdownMenuItem key={title} onClick={() => onDictate({ kind: 'section', title })}>
                    {title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {state.sections.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onClick={() => onDictate({ kind: 'cursor' })}>
                An der Schreibmarke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {action('Einfügen', <Import aria-hidden />, onImport)}
          {action(
            'Word-Datei',
            <FileDown aria-hidden />,
            () =>
              void (async () => {
                try {
                  const { exportDocx } = await import('./export-docx');
                  await exportDocx(editor.getJSON(), documentTitle);
                  toast.success('Word-Datei im Ordner „Downloads" gespeichert.');
                } catch {
                  toast.error('Die Word-Datei konnte nicht erstellt werden.');
                }
              })(),
          )}
          <Button
            variant={copied ? 'secondary' : 'default'}
            onClick={() => void copyAll()}
            title="Kopieren"
            className="shrink-0 px-4"
          >
            {/* The confirmation swaps in place — the key never resizes under
                the cursor mid-click. */}
            <span className="grid size-4 place-items-center">
              {copied ? (
                <Check className="motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" aria-hidden />
              ) : (
                <ClipboardCopy aria-hidden />
              )}
            </span>
            <span className="hidden lg:inline">{copied ? 'Kopiert' : 'Kopieren'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
