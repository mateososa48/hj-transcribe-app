import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, FilePlus2, RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Result, Session, Transcription } from '@/lib/db';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import { BeurteilungText } from './BeurteilungText';
import { ErgaenzungButton, ErgaenzungList, ErgaenzungPopup } from './Ergaenzung';
import type { ActiveProcessingPhase } from './processing-handoff-model';
import { ProcessingHandoff } from './ProcessingHandoff';
import { SyncedPlayback } from './SyncedPlayback';
import { useBeurteilung } from './useBeurteilung';

/**
 * The finished Diktat page: two equal-height framed panels whose header
 * rules align — the Beurteilung left with the one action that matters
 * (Kopieren, a glossy pill), the Aufnahme right with the player fixed and
 * the follow-along transcript scrolling inside whatever height the letter
 * dictates.
 *
 * While the pipeline runs, the page shows ONLY the handoff animation; when
 * the text arrives, the animation resolves into a check mark that fades,
 * and then the panels appear.
 */
export function DiktatContent({
  session,
  transcription,
  result,
  phase,
  failed,
  errorText,
  canGenerate,
  onChanged,
}: {
  session: Session;
  transcription: Transcription | null;
  result: Result | null;
  phase: ActiveProcessingPhase | null;
  failed: boolean;
  errorText: string;
  canGenerate: boolean;
  running: boolean;
  onChanged: () => void;
}) {
  const b = useBeurteilung(result);
  const [ergOpen, setErgOpen] = useState(false);
  const [ergVersion, setErgVersion] = useState(0);

  /**
   * The arrival sequence. 'success' and 'closing' only ever happen when this
   * mounted page WATCHED the pipeline finish — reopening an old Diktat goes
   * straight to the content, no ceremony.
   */
  const [arrival, setArrival] = useState<'none' | 'success' | 'closing' | 'entered'>('none');
  const sawRunning = useRef(false);
  // The sequence timers must survive re-renders: the result object changes
  // identity when the page reloads it from the DB, and a per-run effect
  // cleanup would cancel the check mark mid-flight. Cleared on unmount only.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (phase) {
      sawRunning.current = true;
      return;
    }
    if (sawRunning.current && result && !failed) {
      sawRunning.current = false;
      setArrival('success');
      timersRef.current.push(setTimeout(() => setArrival('closing'), 1100));
      timersRef.current.push(setTimeout(() => setArrival('entered'), 1450));
    }
    if (sawRunning.current && failed) sawRunning.current = false;
  }, [phase, result, failed]);

  if (phase) {
    return <ProcessingHandoff
        kind="beurteilung"
        phase={phase}
        sessionId={session.id}
        audioDurationMs={session.durationMs}
      />;
  }

  if (arrival === 'success' || arrival === 'closing') {
    return (
      <div role="status" aria-label="Fertig" className="flex min-h-56 items-center justify-center py-12">
        <div
          className={cn(
            'flex size-16 items-center justify-center rounded-full bg-foreground text-background shadow-lg',
            arrival === 'success'
              ? 'motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300'
              : 'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-95 motion-safe:duration-300 motion-safe:fill-mode-forwards',
          )}
        >
          <Check className="size-8" strokeWidth={2.5} aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-8',
        arrival === 'entered' && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
      )}
    >
      {failed ? (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
          <p className="font-medium text-destructive">{errorText}</p>
          <Button size="lg" variant="outline" onClick={() => void pipeline.process(session.id)}>
            <RotateCcw aria-hidden />
            Erneut versuchen
          </Button>
        </div>
      ) : null}

      {/* items-stretch (grid default) is the symmetry: both panels share one
          row height, driven by the letter; the transcript scrolls inside. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-8">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                Zusammenfassende Beurteilung
              </h2>
              {b.copiedOnce ? (
                <Badge variant="secondary">
                  <Check aria-hidden />
                  Kopiert
                </Badge>
              ) : null}
            </div>
            {result ? (
              <Button
                size="lg"
                variant={b.copied ? 'secondary' : 'default'}
                onClick={() => void b.copy()}
                className="rounded-full"
              >
                {b.copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
                {b.copied ? 'Kopiert' : 'Kopieren'}
              </Button>
            ) : null}
          </header>

          {result ? (
            <>
              <BeurteilungText b={b} className="flex-1 px-5 py-4 sm:px-6" />
              <footer className="shrink-0 border-t border-border px-5 py-3 sm:px-6">
                <ErgaenzungButton onClick={() => setErgOpen(true)} disabled={ergOpen} />
              </footer>
            </>
          ) : (
            <div className="flex-1 space-y-4 px-5 py-5 sm:px-6">
              {canGenerate ? (
                <>
                  <p className="max-w-[56ch] text-muted-foreground">
                    Die Aufnahme ist erkannt, der Text wurde noch nicht erstellt.
                  </p>
                  <Button size="lg" onClick={() => void pipeline.process(session.id)}>
                    <FilePlus2 aria-hidden />
                    Text erstellen
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Noch kein Text zu dieser Aufnahme.</p>
              )}
            </div>
          )}
        </section>

        {/* The cell reports no height of its own (the panel is absolute at
            xl), so the row — and with it this panel — is exactly as tall as
            the letter. The transcript inside scrolls. */}
        <div className="relative min-w-0">
          <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card xl:absolute xl:inset-0">
            <header className="flex h-16 shrink-0 items-center border-b border-border bg-muted/40 px-5 sm:px-6">
              <h2 className="text-lg font-semibold tracking-tight">Aufnahme</h2>
            </header>
            <SyncedPlayback
              sessionId={session.id}
              words={transcription?.words ?? []}
              fallbackText={transcription?.text ?? ''}
            />
            <ErgaenzungList sessionId={session.id} version={ergVersion} />
          </section>
        </div>
      </div>

      {ergOpen ? (
        <ErgaenzungPopup
          parentId={session.id}
          onMerged={() => {
            setErgVersion((v) => v + 1);
            onChanged();
          }}
          onClose={() => setErgOpen(false)}
        />
      ) : null}
    </div>
  );
}
