import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { newId } from '@/lib/db';
import { cn } from '@/lib/utils';

/**
 * Dictations that are still being written up, after their recording window
 * has gone.
 *
 * The recorder used to own this waiting itself: the window stayed on screen
 * through transcription, so starting a second dictation while the first was
 * still processing re-used that same window — no new recording began, the
 * spinner relabelled itself to the new section, and the first dictation's text
 * was then inserted into the SECOND one's section. He lost a minute of speech
 * and gained it in the wrong place.
 *
 * So the wait moved out here. The window records and leaves; each finished
 * dictation becomes its own small job, carrying its own destination, working
 * on its own. Any number can be in flight, the microphone is free again the
 * moment he presses Fertig, and nothing a job does depends on a window still
 * being mounted.
 */

export interface DictationJob {
  id: string;
  /** While it works: „Befunde" wird geschrieben … */
  processingText: string;
  /** When it lands: In „Befunde" eingefügt */
  successText: string;
  stage: 'processing' | 'success' | 'error';
  error: string | null;
  /** Offered on the finished chip, when the work can be taken back. */
  undo: (() => void) | null;
}

export interface DictationJobSpec {
  processingText: string;
  successText: string;
  /**
   * Transcribe, draft and file the dictation. Must close over its OWN
   * destination — never read one out of component state, which by then
   * belongs to whatever he started next.
   *
   * May return an undo, which the finished chip then offers.
   */
  run: () => Promise<void | (() => void)>;
}

/** How long a finished chip stays, and with it its Rückgängig. */
const SUCCESS_MS = 6000;

export interface DictationJobs {
  jobs: DictationJob[];
  enqueue: (spec: DictationJobSpec) => void;
  retry: (id: string) => void;
  discard: (id: string) => void;
}

export function useDictationJobs(): DictationJobs {
  const [jobs, setJobs] = useState<DictationJob[]>([]);
  /** Kept out of state: a job's work is a closure, not rendered data. */
  const runs = useRef(new Map<string, DictationJobSpec['run']>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const patch = useCallback((id: string, next: Partial<DictationJob>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...next } : job)));
  }, []);

  const discard = useCallback((id: string) => {
    runs.current.delete(id);
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const execute = useCallback(
    async (id: string) => {
      const run = runs.current.get(id);
      if (!run) return;
      patch(id, { stage: 'processing', error: null, undo: null });
      try {
        const undo = await run();
        patch(id, { stage: 'success', undo: undo ?? null });
        timers.current.push(setTimeout(() => discard(id), SUCCESS_MS));
      } catch (error) {
        patch(id, {
          stage: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Das Diktat konnte nicht verarbeitet werden.',
        });
      }
    },
    [patch, discard],
  );

  const enqueue = useCallback(
    (spec: DictationJobSpec) => {
      const id = newId();
      runs.current.set(id, spec.run);
      setJobs((prev) => [
        ...prev,
        {
          id,
          processingText: spec.processingText,
          successText: spec.successText,
          stage: 'processing',
          error: null,
          undo: null,
        },
      ]);
      void execute(id);
    },
    [execute],
  );

  return { jobs, enqueue, retry: execute, discard };
}

/**
 * The jobs as a stack of small cards, out of the way of the page and of the
 * recording window. Deliberately quiet: one line of text and, when there is
 * something to do about it, one key.
 */
export function DictationJobList({
  jobs,
  onRetry,
  onDiscard,
  className,
}: {
  jobs: DictationJob[];
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  className?: string;
}) {
  if (jobs.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className={cn('pointer-events-none flex flex-col items-end gap-2', className)}
    >
      {jobs.map((job) => (
        <Chip key={job.id} job={job} onRetry={onRetry} onDiscard={onDiscard} />
      ))}
    </div>
  );
}

function Chip({
  job,
  onRetry,
  onDiscard,
}: {
  job: DictationJob;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const wrap = (children: ReactNode) => (
    <div
      className={cn(
        'pointer-events-auto flex max-w-[30rem] items-center gap-2.5 rounded-xl border border-border bg-card py-2 ps-3 pe-2.5 shadow-lg',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300',
      )}
    >
      {children}
    </div>
  );

  if (job.stage === 'processing') {
    return wrap(
      <>
        <Spinner className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {job.processingText}
        </p>
      </>,
    );
  }

  if (job.stage === 'success') {
    return wrap(
      <>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
          <Check className="size-3.5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{job.successText}</p>
        {job.undo ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-sm text-muted-foreground"
            onClick={() => {
              job.undo?.();
              onDiscard(job.id);
            }}
          >
            Rückgängig
          </Button>
        ) : null}
      </>,
    );
  }

  return wrap(
    <>
      <p className="min-w-0 flex-1 text-sm text-destructive">{job.error}</p>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Erneut versuchen"
        title="Erneut versuchen"
        className="size-8 shrink-0"
        onClick={() => onRetry(job.id)}
      >
        <RotateCcw aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Verwerfen"
        title="Verwerfen"
        className="size-8 shrink-0 text-muted-foreground"
        onClick={() => onDiscard(job.id)}
      >
        <X aria-hidden />
      </Button>
    </>,
  );
}
