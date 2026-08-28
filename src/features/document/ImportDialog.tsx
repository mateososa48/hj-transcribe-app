import { useMemo, useState } from 'react';
import { ArrowLeft, Check, MessagesSquare, Mic } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { db, KIND_SECTIONS, SECTION_LABELS, type Result } from '@/lib/db';
import {
  sessionSubtitle,
  sessionTimeTitle,
  useSessions,
  type SessionSummary,
} from '@/features/sessions/useSessions';
import { cn } from '@/lib/utils';

/**
 * Import: pull sections out of an existing Termin or Diktat straight into the
 * Bericht — the copy-paste loop this app exists to remove. A modal is the
 * right shape here (one focused pick-one-of-N task); the working copy WITH
 * his corrections is what gets imported, never the model's original.
 */
export function ImportDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (sections: Array<{ key: string; label: string; text: string }>) => void;
}) {
  const { sessions } = useSessions(200);
  const [picked, setPicked] = useState<SessionSummary | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const withResults = useMemo(() => sessions.filter((s) => s.hasResult), [sessions]);
  const diktate = withResults.filter((s) => s.session.kind === 'beurteilung');
  const termine = withResults.filter((s) => s.session.kind === 'gespraech');

  const reset = () => {
    setPicked(null);
    setResult(null);
    setSelected(new Set());
  };

  async function pick(item: SessionSummary) {
    const row = await db.results.where('sessionId').equals(item.session.id).first();
    if (!row) return;
    const nonEmpty = KIND_SECTIONS[item.session.kind].filter((key) =>
      (row.sections[key] ?? '').trim(),
    );
    setPicked(item);
    setResult(row);
    setSelected(new Set(nonEmpty));
  }

  function insert() {
    if (!picked || !result) return;
    const sections = KIND_SECTIONS[picked.session.kind]
      .filter((key) => selected.has(key))
      .map((key) => ({
        key,
        label: SECTION_LABELS[key] ?? key,
        text: result.sections[key] ?? '',
      }));
    onInsert(sections);
    onOpenChange(false);
    reset();
    toast.success('Eingefügt.');
  }

  const Row = ({ item }: { item: SessionSummary }) => (
    <button
      type="button"
      onClick={() => void pick(item)}
      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="font-medium">{sessionTimeTitle(item.session)}</span>
      <span className="text-sm text-muted-foreground">{sessionSubtitle(item)}</span>
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        {!picked ? (
          <>
            <DialogHeader>
              <DialogTitle>Aus Aufnahme einfügen</DialogTitle>
              <DialogDescription>
                Wählen Sie den Termin oder das Diktat, dessen Text in den Bericht übernommen
                werden soll.
              </DialogDescription>
            </DialogHeader>

            {withResults.length === 0 ? (
              <p className="py-4 text-muted-foreground">
                Noch keine Aufnahmen mit fertigem Text vorhanden.
              </p>
            ) : (
              <div className="space-y-4">
                {diktate.length > 0 ? (
                  <div>
                    <p className="mb-1 flex items-center gap-2 px-3 text-sm font-medium text-muted-foreground">
                      <Mic className="size-4" aria-hidden /> Diktate
                    </p>
                    {diktate.map((item) => (
                      <Row key={item.session.id} item={item} />
                    ))}
                  </div>
                ) : null}
                {termine.length > 0 ? (
                  <div>
                    <p className="mb-1 flex items-center gap-2 px-3 text-sm font-medium text-muted-foreground">
                      <MessagesSquare className="size-4" aria-hidden /> Termine
                    </p>
                    {termine.map((item) => (
                      <Row key={item.session.id} item={item} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{sessionTimeTitle(picked.session)}</DialogTitle>
              <DialogDescription>
                Diese Abschnitte werden mit Überschrift in den Bericht eingefügt.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              {KIND_SECTIONS[picked.session.kind]
                .filter((key) => (result?.sections[key] ?? '').trim())
                .map((key) => {
                  const on = selected.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-md border transition-colors',
                          on
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background',
                        )}
                      >
                        {on ? <Check className="size-4" aria-hidden /> : null}
                      </span>
                      <span className="font-medium">{SECTION_LABELS[key] ?? key}</span>
                    </button>
                  );
                })}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={reset}>
                <ArrowLeft aria-hidden />
                Zurück
              </Button>
              <Button onClick={insert} disabled={selected.size === 0}>
                Einfügen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
