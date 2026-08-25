export type PlaybackSpeed = 0.5 | 1 | 2;

export interface LabStage {
  id: 'secured' | 'transcribing' | 'drafting' | 'done';
  label: string;
  startsAt: number;
}

export const LAB_STAGES: readonly [LabStage, LabStage, LabStage, LabStage] = [
  { id: 'secured', label: 'Aufnahme gesichert', startsAt: 0 },
  { id: 'transcribing', label: 'Transkript wird erstellt', startsAt: 0.36 },
  { id: 'drafting', label: 'Notizen werden erstellt', startsAt: 0.72 },
  { id: 'done', label: 'Fertig', startsAt: 0.96 },
];

export function getLabStage(progress: number): LabStage {
  const safeProgress = Math.min(1, Math.max(0, progress));
  return [...LAB_STAGES].reverse().find((stage) => safeProgress >= stage.startsAt) ?? LAB_STAGES[0];
}

export function nextPlaybackSpeed(speed: PlaybackSpeed): PlaybackSpeed {
  if (speed === 0.5) return 1;
  if (speed === 1) return 2;
  return 0.5;
}

export function getMotionClassName({
  paused,
  speed,
  reduced,
}: {
  paused: boolean;
  speed: PlaybackSpeed;
  reduced: boolean;
}): string {
  const classes = [`speed-${speed === 0.5 ? '05' : speed}`];
  if (paused) classes.push('is-paused');
  if (reduced) classes.push('is-reduced');
  return classes.join(' ');
}
