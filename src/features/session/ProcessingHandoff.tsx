import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

import { formatElapsed } from '@/features/record/elapsed';
import { usePipelineState } from '@/features/record/useRecording';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import {
  estimatePhaseMs,
  getProcessingHandoffCopy,
  getProcessingSteps,
  isOverrunning,
  phaseProgress,
  type ActiveProcessingPhase,
  type ProcessingStep,
} from './processing-handoff-model';

/**
 * What the app is doing between "stop" and "here is your letter".
 *
 * The rule this screen is built on: **nothing here moves unless it is true.**
 * The previous version animated packets along a rail and bounced a row of
 * bars — motion invented to fill a wait, tied to no measurement, and carrying
 * no words at all, so the one person who uses this app had to infer from an
 * abstract diagram whether his dictation was being transcribed or was stuck.
 *
 * So: no keyframes. The elapsed time is real and counted from the moment the
 * phase actually began (`phaseStartedAt`, not this component's mount, so
 * leaving the page and returning still tells the truth). The bar is elapsed
 * measured against an estimate derived from the real length of the recording,
 * it stops short of the end instead of pretending to finish, and when the
 * estimate is wrong the screen says so in plain German rather than sitting
 * at 100%.
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
  const copy = getProcessingHandoffCopy(kind, phase);
  const steps = getProcessingSteps(kind, phase);
  const pipelineState = usePipelineState(sessionId ?? null);

  // Falls back to mount time only when there is no pipeline clock to read
  // (the ?processing= dev preview), never in the real flow.
  const mountedAt = useRef(Date.now());
  const startedAt = startedAtProp ?? (pipelineState.phaseStartedAt || mountedAt.current);

  const now = useTick(1000);
  const elapsedMs = Math.max(0, now - startedAt);
  const estimateMs = estimatePhaseMs(phase, audioDurationMs);
  const progress = phaseProgress(elapsedMs, estimateMs);
  const overrunning = isOverrunning(elapsedMs, estimateMs);

  return (
    <section
      role="status"
      aria-live="polite"
      // Capped: a status block stretched across a 1300px column turns the
      // rail into a hairline and strands the timer a page away from its title.
      className="max-w-2xl rounded-xl border border-border bg-card px-5 py-5 sm:px-8 sm:py-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
        {/* Ticking once a second — announced by a live region it would be
            unbearable, so the phase text carries the meaning for AT. */}
        <span className="text-2xl font-semibold tabular-nums tracking-tight" aria-hidden>
          {formatElapsed(startedAt, null, now, true)}
        </span>
      </div>

      <p className="mt-1.5 max-w-[60ch] text-base text-muted-foreground">{copy.description}</p>

      {/* Elapsed against the estimate. Held below full on purpose: this bar
          may only ever claim what it can measure. */}
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            'h-full origin-left rounded-full bg-foreground',
            'transition-transform duration-1000 ease-linear motion-reduce:transition-none',
          )}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <ol className="mt-5 space-y-2.5">
        {steps.map((step) => (
          <Step key={step.label} step={step} />
        ))}
      </ol>

      <p className="mt-5 max-w-[60ch] text-sm text-muted-foreground">
        {overrunning
          ? 'Das dauert diesmal länger als sonst. Die Verarbeitung läuft weiter — Sie können das Fenster offen lassen.'
          : 'Sie können das Fenster offen lassen.'}
      </p>
    </section>
  );
}

function Step({ step }: { step: ProcessingStep }) {
  const { state, label } = step;
  return (
    <li className="flex items-center gap-3 text-base">
      <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
        {state === 'done' ? (
          <Check className="size-5 text-foreground" />
        ) : state === 'active' ? (
          <span className="size-2.5 rounded-full bg-foreground" />
        ) : (
          <span className="size-2.5 rounded-full border-[1.5px] border-muted-foreground/60" />
        )}
      </span>
      <span className={cn(state === 'waiting' ? 'text-muted-foreground' : 'font-medium')}>
        {label}
      </span>
    </li>
  );
}

/** Re-renders on an interval so elapsed time stays live. */
function useTick(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
