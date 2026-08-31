import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { usePipelineState } from '@/features/record/useRecording';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import {
  estimatePhaseMs,
  getProcessingSteps,
  isOverrunning,
  type ActiveProcessingPhase,
  type ProcessingStep,
} from './processing-handoff-model';

/**
 * What the app is doing between "stop" and "here is your letter".
 *
 * One spinner in the middle of the page, and under it the steps the pipeline
 * actually has — the transcript, then the text made from it. A step that is
 * running carries its own small spinner; a step that is finished carries a
 * check and steps back into grey; the step after it only appears once the one
 * before it is done. Nothing else is on screen: no tabs, no empty panels
 * waiting to be filled, no ambient copy.
 *
 * The steps themselves are true — they change when the pipeline changes phase,
 * not on a timer — and if a phase runs longer than the recording's own length
 * predicts, the screen says so rather than spinning silently forever. That
 * sentence is the one thing here that is not decoration, and it is why a
 * stalled transcription cannot look identical to a slow one.
 */
export function ProcessingHandoff({
  kind,
  phase,
  sessionId,
  audioDurationMs,
  startedAt: startedAtProp,
}: {
  kind: SessionKind;
  phase: ActiveProcessingPhase;
  /** Reads the phase's true start time. Omitted only by the dev preview. */
  sessionId?: string | undefined;
  /** Length of the recording, which is what transcription time scales with. */
  audioDurationMs?: number | undefined;
  /**
   * Supplies the phase clock directly instead of reading the pipeline's.
   * The preview harness (`preview.html`) uses this to scrub the screen to any
   * point in the wait — including the overrun state — without waiting it out.
   */
  startedAt?: number | undefined;
}) {
  const steps = getProcessingSteps(kind, phase);
  const pipelineState = usePipelineState(sessionId ?? null);

  // Falls back to mount time only when there is no pipeline clock to read
  // (the ?processing= dev preview), never in the real flow.
  const mountedAt = useRef(Date.now());
  const startedAt = startedAtProp ?? (pipelineState.phaseStartedAt || mountedAt.current);

  const now = useTick(1000);
  const elapsedMs = Math.max(0, now - startedAt);
  const overrunning = isOverrunning(elapsedMs, estimatePhaseMs(phase, audioDurationMs));

  // A step he has not reached yet is not information — it is a promise about
  // work that has not started. Only what has happened is shown.
  const reached = steps.filter((step) => step.state !== 'waiting');

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex min-h-[20rem] flex-col items-center justify-center py-16 text-center"
    >
      <Spinner className="size-8 text-muted-foreground" aria-hidden />

      <ol className="mt-7 space-y-2.5">
        {reached.map((step) => (
          <Step key={step.label} step={step} />
        ))}
      </ol>

      {overrunning ? (
        <p className="mt-6 max-w-[46ch] text-sm text-muted-foreground">
          Das dauert diesmal länger als sonst. Die Verarbeitung läuft weiter — Sie können das
          Fenster offen lassen.
        </p>
      ) : null}
    </section>
  );
}

function Step({ step }: { step: ProcessingStep }) {
  const done = step.state === 'done';
  return (
    <li
      className={cn(
        'flex items-center justify-center gap-2.5 text-base',
        // The second line arrives when its work does.
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
        {done ? (
          <Check className="size-4 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" />
        ) : (
          <Spinner className="size-4" />
        )}
      </span>
      <span className={done ? 'text-muted-foreground' : 'font-medium'}>{step.label}</span>
    </li>
  );
}

/** Re-renders on an interval so the overrun notice can appear on time. */
function useTick(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
