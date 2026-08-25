import { FilePlus2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { ProcessingHandoff } from '@/features/session/ProcessingHandoff';
import { deleteSession } from '@/lib/generate';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { DiktatCtx } from './design-context';

/**
 * The behaviour layer under the ten Diktat designs: title editing, deletion,
 * pipeline status and the empty state, each stylable but never re-implemented.
 * A design that forgot the interrupted-recording recovery path would silently
 * lose audio — so no design is allowed to write these from scratch.
 */

export function DiktatTitle({ ctx, className }: { ctx: DiktatCtx; className?: string }) {
  return (
    <Input
      value={ctx.title}
      onChange={(e) => ctx.setTitle(e.target.value)}
      onBlur={() => void ctx.saveTitle()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      aria-label="Titel der Aufnahme"
      className={cn(
        'h-auto border-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:border-border focus-visible:px-2 md:text-2xl',
        className,
      )}
    />
  );
}

export function DeleteRecordingButton({
  ctx,
  trigger,
}: {
  ctx: DiktatCtx;
  /** The design's own button element; default is the quiet ghost button. */
  trigger?: React.ReactElement;
}) {
  const goHome = useAppStore((s) => s.goHome);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const disabled = ctx.state === 'live';

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" className="text-muted-foreground" disabled={disabled}>
              <Trash2 aria-hidden />
              Löschen
            </Button>
          )
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aufnahme wirklich löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Ton, erkannter Text und Beurteilung werden von diesem Computer entfernt. Das lässt sich
            nicht rückgängig machen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              await deleteSession(ctx.session.id);
              touchSessions();
              toast.success('Aufnahme gelöscht.');
              goHome();
            }}
          >
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Live / interrupted / processing / failed, in the design's flow. Returns null
 * when the page is simply ready. Live and interrupted REPLACE the content —
 * designs check `ctx.state` for that; this component only renders the notice.
 */
export function DiktatStatus({ ctx, className }: { ctx: DiktatCtx; className?: string }) {
  const startRecording = useAppStore((s) => s.startRecording);

  if (ctx.state === 'live') {
    return (
      <Item variant="outline" className={className}>
        <ItemContent>
          <ItemTitle>Diese Aufnahme läuft gerade</ItemTitle>
          <ItemDescription>
            Der Text entsteht, sobald Sie das Diktat beenden.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="lg" onClick={() => startRecording('beurteilung')}>
            Zur Aufnahme
          </Button>
        </ItemActions>
      </Item>
    );
  }

  if (ctx.state === 'interrupted') {
    return (
      <Item variant="outline" className={className}>
        <ItemContent>
          <ItemTitle>Unterbrochene Aufnahme gefunden</ItemTitle>
          <ItemDescription>
            Dieses Diktat wurde nicht ordentlich beendet. Der Ton ist gespeichert und kann
            weiterverwendet werden.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <DeleteRecordingButton
            ctx={ctx}
            trigger={
              <Button variant="outline" size="lg">
                Verwerfen
              </Button>
            }
          />
          <Button size="lg" onClick={() => void ctx.recover()}>
            Weiterverwenden
          </Button>
        </ItemActions>
      </Item>
    );
  }

  if (ctx.state === 'processing' && ctx.phase) {
    return (
      <div className={className}>
        <ProcessingHandoff kind="beurteilung" phase={ctx.phase} />
      </div>
    );
  }

  if (ctx.state === 'failed') {
    return (
      <div
        className={cn(
          'space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4',
          className,
        )}
      >
        <p className="font-medium text-destructive">{ctx.errorText}</p>
        <Button size="lg" variant="outline" onClick={ctx.retry}>
          <RotateCcw aria-hidden />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return null;
}

/** What stands where the Beurteilung will be, before there is one. */
export function DiktatEmptyText({ ctx, className }: { ctx: DiktatCtx; className?: string }) {
  if (ctx.state === 'processing') {
    return <p className={cn('text-muted-foreground', className)}>Der Text erscheint hier gleich.</p>;
  }
  if (ctx.canGenerate) {
    return (
      <div className={cn('space-y-4', className)}>
        <p className="max-w-[56ch] text-muted-foreground">
          Die Aufnahme ist erkannt, der Text wurde noch nicht erstellt.
        </p>
        <Button size="lg" onClick={ctx.retry}>
          <FilePlus2 aria-hidden />
          Text erstellen
        </Button>
      </div>
    );
  }
  if (ctx.state === 'ready') {
    return <p className={cn('text-muted-foreground', className)}>Noch kein Text zu dieser Aufnahme.</p>;
  }
  return null;
}
