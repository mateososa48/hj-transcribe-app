import type { SessionKind } from '@/lib/db';

export type ActiveProcessingPhase = 'transcribing' | 'notes';
export type ProcessingStepState = 'active' | 'done' | 'waiting';

export interface ProcessingHandoffCopy {
  title: string;
  description: string;
  firstStep: ProcessingStepState;
  secondStep: ProcessingStepState;
}

export function getProcessingHandoffCopy(
  kind: SessionKind,
  phase: ActiveProcessingPhase,
): ProcessingHandoffCopy {
  if (phase === 'transcribing') {
    return {
      title: 'Die Aufnahme wird übertragen',
      description: 'Gesprochenes wird jetzt in ein Transkript umgewandelt.',
      firstStep: 'active',
      secondStep: 'waiting',
    };
  }

  const isAppointment = kind === 'gespraech';
  return {
    title: isAppointment ? 'Die Notizen entstehen' : 'Der Text entsteht',
    description: isAppointment
      ? 'Das Transkript wird jetzt in übersichtliche Abschnitte geordnet.'
      : 'Das Transkript wird jetzt als Zusammenfassende Beurteilung formuliert.',
    firstStep: 'done',
    secondStep: 'active',
  };
}

export function getProcessingPreviewPhase(
  search: string,
  isDevelopment: boolean,
): ActiveProcessingPhase | null {
  if (!isDevelopment) return null;
  const phase = new URLSearchParams(search).get('processing');
  return phase === 'transcribing' || phase === 'notes' ? phase : null;
}

/**
 * Rough pacing for the progress indicator — NOT a promise, and never shown as
 * a number. Transcription scales with the length of the recording; drafting is
 * roughly flat because the model reads a transcript, not audio.
 *
 * The indicator holds short of the end rather than completing on the estimate,
 * and the screen says plainly when a phase runs longer than this predicted.
 * A bar that silently sits at 100% is the lie this design exists to avoid.
 */
export function estimatePhaseMs(
  phase: ActiveProcessingPhase,
  audioDurationMs = 0,
): number {
  const audio = Math.max(0, audioDurationMs);
  return phase === 'transcribing' ? 20_000 + audio * 0.1 : 20_000 + audio * 0.02;
}

/** How far through the estimate we are, clamped so it never reads as finished. */
export const PROGRESS_CEILING = 0.92;

export function phaseProgress(elapsedMs: number, estimateMs: number): number {
  if (estimateMs <= 0) return 0;
  return Math.min(Math.max(elapsedMs / estimateMs, 0), 1) * PROGRESS_CEILING;
}

export function isOverrunning(elapsedMs: number, estimateMs: number): boolean {
  return estimateMs > 0 && elapsedMs > estimateMs;
}

export interface ProcessingStep {
  label: string;
  state: ProcessingStepState;
}

/**
 * The two real steps of the pipeline, in order, each carrying its own state.
 *
 * These labels are what the screen SAYS — the earlier version computed this
 * shape and then drew a wordless diagram instead, leaving the user to infer
 * from an animation what the app was doing.
 */
export function getProcessingSteps(
  kind: SessionKind,
  phase: ActiveProcessingPhase,
): [ProcessingStep, ProcessingStep] {
  const { firstStep, secondStep } = getProcessingHandoffCopy(kind, phase);
  return [
    {
      label: firstStep === 'done' ? 'Transkript erstellt' : 'Transkript wird erstellt',
      state: firstStep,
    },
    {
      label:
        kind === 'gespraech' ? 'Notizen werden erstellt' : 'Beurteilung wird formuliert',
      state: secondStep,
    },
  ];
}
