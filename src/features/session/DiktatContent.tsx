import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, FilePlus2, RotateCcw } from 'lucide-react';

import { BouncyAccordion } from '@/components/motion/bouncy-accordion';
import { RecordingBody } from '@/components/recording-body';
import { Button } from '@/components/ui/button';
import { db, type Result, type Session, type Transcription } from '@/lib/db';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import { DictationJobList, useDictationJobs } from '@/features/record/dictation-jobs';
import { formatDuration } from '@/features/sessions/useSessions';
import { BeurteilungText } from './BeurteilungText';
import { ergaenzungJob, ErgaenzungButton, ErgaenzungPopup } from './Ergaenzung';
import type { ActiveProcessingPhase } from './processing-handoff-model';
import { ProcessingHandoff } from './ProcessingHandoff';
import { RegenerateControls } from './RegenerateControls';
import { useBeurteilung } from './useBeurteilung';

/**
 * The finished Diktat: one column, read top to bottom in the order the work
 * happens.
 *
 * It used to be two framed panels of equal height — the letter left, the
 * recording right — and the trouble was never only that the recording was too
 * wide. The two panels held THE SAME CONTENT TWICE: a wall of German prose
 * beside a near-identical wall of German prose. He read the left one and the
 * right one added noise, when its actual job is settling one question
 * occasionally — "did I really say 140 over 90?"
 *
 * So the text stops being a card with furniture above and below it and becomes
 * the page: one measure, one heading, nothing boxing it in. The recording
 * moves underneath it, quiet and labelled, where checking belongs. Demoted by
 * position and weight — never hidden, because a source he cannot see is a
 * source he stops checking.
 *
 * No paper here, unlike a Bericht. That is a whole letter and looks like one;
 * this is one section on its way into his Word template, and dressing a
 * snippet as a page would promise something it is not.
 */
interface ErgaenzungRow {
  session: Session;
  transcription: Transcription | null;
}

export function DiktatContent({
  session,
  transcription,
  result,
  phase,
  failed,
  errorText,
  canGenerate,
  running,
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
  /** Ergänzungen still being worked into the letter. */
  const jobs = useDictationJobs();
  /** Which recording stands open. One at a time; all shut to begin with. */
  const [openRecording, setOpenRecording] = useState<string | null>(null);
  const [ergaenzungen, setErgaenzungen] = useState<ErgaenzungRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const children = (await db.sessions.filter((s) => s.parentId === session.id).toArray())
        .filter((s) => s.status === 'stopped')
        .sort((a, b) => a.startedAt - b.startedAt);
      const rows = await Promise.all(
        children.map(async (child) => ({
          session: child,
          transcription:
            (await db.transcriptions.where('sessionId').equals(child.id).first()) ?? null,
        })),
      );
      if (!cancelled) setErgaenzungen(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, ergVersion]);

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
    return (
      <ProcessingHandoff
        kind="beurteilung"
        phase={phase}
        sessionId={session.id}
        audioDurationMs={session.durationMs}
      />
    );
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

  /** The recordings behind this text: the dictation itself, then its additions. */
  const recordings = [
    { key: session.id, label: 'Aufnahme', row: { session, transcription } },
    ...ergaenzungen.map((row, i) => ({
      key: row.session.id,
      label: `${i + 1}. Ergänzung`,
      row,
    })),
  ];

  return (
    <div
      className={cn(
        arrival === 'entered' && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
      )}
    >
      {failed ? (
        <div className="mb-8 space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
          <p className="font-medium text-destructive">{errorText}</p>
          <Button size="lg" variant="outline" onClick={() => void pipeline.process(session.id)}>
            <RotateCcw aria-hidden />
            Erneut versuchen
          </Button>
        </div>
      ) : null}

      {result ? (
        <>
          {/* The two things he does with a finished text, and nothing else.
              Sticky, because Kopieren is wanted at the END of reading and a
              key that has scrolled off the top is a key he has to go back
              for. Neu erstellen is not here on purpose — see below. */}
          <div className="sticky top-0 z-20 -mx-2 mb-8 flex items-center justify-end gap-3 border-b border-border bg-background/85 px-2 py-3 backdrop-blur-md">
            {b.copiedOnce && !b.copied ? (
              <span className="text-sm text-muted-foreground">Bereits kopiert</span>
            ) : null}
            <ErgaenzungButton onClick={() => setErgOpen(true)} disabled={ergOpen} />
            <Button
              size="lg"
              variant={b.copied ? 'secondary' : 'default'}
              onClick={() => void b.copy()}
              className="rounded-full px-5"
            >
              <span className="grid size-4 place-items-center">
                {b.copied ? (
                  <Check
                    className="motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200"
                    aria-hidden
                  />
                ) : (
                  <ClipboardCopy aria-hidden />
                )}
              </span>
              {b.copied ? 'Kopiert' : 'Kopieren'}
            </Button>
          </div>

          {/* The work. No card, no header rule, no footer — the page IS this. */}
          <section aria-labelledby="beurteilung-heading">
            <h2 id="beurteilung-heading" className="mb-3 text-lg font-semibold tracking-tight">
              Zusammenfassende Beurteilung
            </h2>
            <BeurteilungText b={b} className="-mx-3 rounded-lg px-3 py-1" />
          </section>

          {/* Rare, considered, and only ever wanted AFTER reading — so it sits
              where reading ends rather than competing in the stripe. */}
          <RegenerateControls
            session={session}
            result={result}
            running={running}
            onChanged={onChanged}
            className="mt-6 border-t border-border pt-4"
          />

          {/* The evidence, underneath the thing it produced. */}
          <section aria-labelledby="aufnahme-heading" className="mt-12">
            <h2
              id="aufnahme-heading"
              className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground"
            >
              {recordings.length > 1 ? 'Aufnahmen' : 'Aufnahme'}
            </h2>
            <BouncyAccordion
              separated
              radius={14}
              value={openRecording}
              onValueChange={setOpenRecording}
              classNames={{
                item: 'border border-border shadow-sm',
                trigger: 'min-h-12 gap-2 px-4',
                title: 'text-sm font-normal',
                chevron: 'size-5',
                description: 'text-sm text-foreground',
              }}
              items={recordings.map(({ key, label, row }) => ({
                id: key,
                title: (
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-medium">{label}</span>
                    {row.session.durationMs ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        · {formatDuration(row.session.durationMs)}
                      </span>
                    ) : null}
                  </span>
                ),
                description: (
                  <RecordingBody
                    session={row.session}
                    transcription={row.transcription}
                    active={openRecording === key}
                  />
                ),
              }))}
            />
          </section>
        </>
      ) : (
        <div className="space-y-4">
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

      {/* Ergänzungen still being worked in, in the bottom-right corner rather
          than on top of the recorder — the microphone is free immediately. */}
      <DictationJobList
        jobs={jobs.jobs}
        raised={ergOpen}
        onRetry={jobs.retry}
        onDiscard={jobs.discard}
      />

      {ergOpen ? (
        <ErgaenzungPopup
          parentId={session.id}
          onCaptured={(childId) =>
            jobs.enqueue(
              ergaenzungJob(session.id, childId, () => {
                setErgVersion((v) => v + 1);
                onChanged();
              }),
            )
          }
          onClose={() => setErgOpen(false)}
        />
      ) : null}
    </div>
  );
}
