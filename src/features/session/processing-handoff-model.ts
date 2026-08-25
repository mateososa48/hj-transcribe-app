import type { SessionKind } from '@/lib/db';

export type ActiveProcessingPhase = 'transcribing' | 'notes';
export type ProcessingStepState = 'active' | 'done' | 'waiting';

export interface ProcessingHandoffCopy {
  title: string;
  description: string;
  sourceLabel: string;
  targetLabel: string;
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
      sourceLabel: 'Aufnahme',
      targetLabel: 'Transkript',
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
    sourceLabel: 'Transkript',
    targetLabel: isAppointment ? 'Notizen' : 'Beurteilung',
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
