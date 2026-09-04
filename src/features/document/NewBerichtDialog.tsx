import { File, FileText } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createDocument, type BerichtStart } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * The one question a new Bericht asks: start from his letter template, or
 * from a blank page.
 *
 * It is asked here rather than inside the letter because the answer decides
 * what the editor opens with — offering "clear all this away" afterwards
 * would mean showing him a page and then taking it apart. Two keys, no
 * default action: the template is the common answer and leads, but the blank
 * page is a peer, not an escape hatch.
 */
export function NewBerichtDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const openDocument = useAppStore((s) => s.openDocument);
  const touchSessions = useAppStore((s) => s.touchSessions);

  async function begin(start: BerichtStart) {
    const doc = await createDocument(start);
    touchSessions();
    openDocument(doc.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Wie soll der Bericht anfangen?</DialogTitle>
          <DialogDescription>
            Die Vorlage ist der übliche Weg; für eine kurze Notiz ist die leere Seite schneller.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          <Choice
            icon={FileText}
            title="Mit Vorlage"
            hint="Briefkopf, Anrede und Ihre gewohnten Überschriften."
            onRun={() => void begin('vorlage')}
          />
          <Choice
            icon={File}
            title="Leere Seite"
            hint="Nichts vorgegeben, Sie fangen bei der ersten Zeile an."
            onRun={() => void begin('leer')}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One of the two ways in, in the app's own flat white key at card scale. */
function Choice({
  icon: Icon,
  title,
  hint,
  onRun,
}: {
  icon: typeof FileText;
  title: string;
  hint: string;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRun}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left',
        // The same material the start screen's secondary keys wear.
        'btn-liquid',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tracking-tight">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
