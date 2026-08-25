import { useState } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { db, type Result, type Session } from '@/lib/db';
import { restorePreviousSections } from '@/lib/generate';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';

/**
 * Regenerate, guarded. When his corrections are in the working copy, the
 * button asks first — and after a regenerate, the replaced version stays one
 * click away. Silently eating four minutes of his edits is the exact class of
 * failure this app exists to prevent.
 */
export function RegenerateControls({
  session,
  result,
  running,
  onChanged,
  className,
}: {
  session: Session;
  result: Result;
  running: boolean;
  onChanged: () => void;
  className?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isTermin = session.kind === 'gespraech';

  const regenerate = () => void pipeline.process(session.id);

  /**
   * Decide at click time, against the database — the in-memory result is
   * loaded once, but his edits autosave straight to the DB underneath it, and
   * a stale comparison would skip the warning exactly when it matters.
   */
  async function decide() {
    const fresh = await db.results.get(result.id);
    const sections = fresh?.sections ?? result.sections;
    const original = fresh?.original ?? result.original;
    const edited = Object.entries(sections).some(([key, value]) => (original[key] ?? '') !== value);
    if (edited) setConfirmOpen(true);
    else regenerate();
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Button
        variant="ghost"
        size="lg"
        disabled={running}
        onClick={() => void decide()}
      >
        <RotateCcw aria-hidden />
        {isTermin ? 'Notizen neu erstellen' : 'Neu erstellen'}
      </Button>

      {result.previousSections ? (
        <Button
          variant="ghost"
          size="lg"
          disabled={running}
          onClick={async () => {
            const restored = await restorePreviousSections(result.id);
            if (restored) {
              toast.success('Die vorherige Fassung ist wiederhergestellt.');
              onChanged();
            }
          }}
        >
          <Undo2 aria-hidden />
          Vorherige Fassung wiederherstellen
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isTermin ? 'Notizen neu erstellen?' : 'Text neu erstellen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben den Text bearbeitet. Beim Neu-Erstellen wird Ihre Fassung ersetzt — Sie
              können sie danach über „Vorherige Fassung wiederherstellen“ zurückholen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                regenerate();
              }}
            >
              Neu erstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
