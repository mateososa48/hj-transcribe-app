import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

import { formatElapsed } from '@/features/record/elapsed';
import { usePipelineState } from '@/features/record/useRecording';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import { loadRecordingShape, SHAPE_RESOLUTION } from './recording-shape';
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
  shape: shapeProp,
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
  /** Overrides the recording outline. Used by the preview harness. */
  shape?: number[] | undefined;
}) {
  const copy = getProcessingHandoffCopy(kind, phase);
  const steps = getProcessingSteps(kind, phase);
  const pipelineState = usePipelineState(sessionId ?? null);

  // Falls back to mount time only when there is no pipeline clock to read
  // (the ?processing= dev preview), never in the real flow.
  const mountedAt = useRef(Date.now());
  const startedAt = startedAtProp ?? (pipelineState.phaseStartedAt || mountedAt.current);

  const loadedShape = useRecordingShape(sessionId, shapeProp);
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

      <RecordingBand shape={loadedShape} progress={progress} phase={phase} />

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

/**
 * The recording, turning into text.
 *
 * One subject changing state, rather than a diagram of boxes passing packets:
 * ahead of the reading head the band stands as the outline of his recording,
 * behind it the same bars have settled into a line of text — and the spaces
 * in that line are where he actually paused, because the quiet stretches of
 * the outline fall below the ink threshold and leave a gap.
 *
 * In the drafting phase the material is already text, so the head sweeps a
 * second time and the writing darkens from grey to ink as it is composed.
 *
 * There is not one keyframe here. The head's position is elapsed-against-
 * estimate, and every bar decides its own state from where it sits relative
 * to that head, so the wipe follows the reading order for free.
 */
function RecordingBand({
  shape,
  progress,
  phase,
}: {
  shape: number[];
  progress: number;
  phase: ActiveProcessingPhase;
}) {
  const bars = shape.length > 0 ? shape : Array.from({ length: SHAPE_RESOLUTION }, () => 0.45);
  const drafting = phase === 'notes';

  return (
    <div className="relative mt-6 h-20 w-full" aria-hidden>
      <div className="flex h-full w-full items-center gap-px">
        {bars.map((value, index) => {
          const position = (index + 0.5) / bars.length;
          const read = position <= progress;
          // A quiet stretch reads as a pause, and a pause is a word space.
          const isPause = value < 0.3;
          const asText = drafting || read;
          return (
            <span
              key={index}
              className={cn(
                'h-full flex-1 origin-center rounded-full',
                'transition-[transform,opacity,background-color] duration-500 ease-out',
                'motion-reduce:transition-none',
                asText && isPause ? 'opacity-0' : 'opacity-100',
                drafting && read ? 'bg-foreground' : asText ? 'bg-muted-foreground/45' : 'bg-foreground',
              )}
              style={{
                transform: asText
                  ? // Settled into a line of writing.
                    `scaleY(${(2.5 / 80).toFixed(4)})`
                  : // Still sound: the outline of the recording itself.
                    `scaleY(${Math.max(value, 0.06).toFixed(3)})`,
              }}
            />
          );
        })}
      </div>

      {/* The reading head. Parks with the estimate rather than running to the
          end, for the same reason the wording admits an overrun. */}
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-px bg-foreground/70',
          'transition-transform duration-1000 ease-linear motion-reduce:transition-none',
        )}
        style={{ transform: `translateX(calc(${(progress * 100).toFixed(2)}cqw))` }}
      />
    </div>
  );
}

/** The recording's own outline, loaded once per session. */
function useRecordingShape(sessionId: string | undefined, override: number[] | undefined): number[] {
  const [shape, setShape] = useState<number[]>([]);
  useEffect(() => {
    if (override || !sessionId) return;
    let cancelled = false;
    void loadRecordingShape(sessionId).then((next) => {
      if (!cancelled) setShape(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, override]);
  return override ?? shape;
}
