import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'recording' | 'paused' | 'warning' | 'error';

export interface RecordingOrbProps {
  /** 0..1 live input level. */
  level: number;
  state: OrbState;
  className?: string;
}

/**
 * The recording indicator.
 *
 * Self-contained and driven by a single `level` prop, exactly as SPEC asks, so
 * the visual can be swapped later without touching the audio pipeline.
 *
 * It is deliberately NOT a pulsing microphone. A decorative pulse animates
 * whether or not the microphone works, which makes it a lie: the one job of
 * this component is to prove that sound is arriving right now. Everything here
 * is driven by real input.
 */
export function RecordingOrb({ level, state, className }: RecordingOrbProps) {
  const active = state === 'recording' || state === 'warning';
  // Clamp: a shout should not blow the ring off the layout.
  const l = Math.max(0, Math.min(1, level));

  return (
    <div
      className={cn('relative grid size-64 place-items-center', className)}
      role="img"
      aria-label={
        state === 'recording'
          ? `Aufnahme läuft, Eingangspegel ${Math.round(l * 100)} Prozent`
          : state === 'warning'
            ? 'Aufnahme läuft, aber es wird kein Ton empfangen'
            : state === 'error'
              ? 'Aufnahme gestoppt, Fehler'
              : 'Bereit zur Aufnahme'
      }
    >
      {/* Outer ring: scales with live level. This is the "is it hearing me?" signal. */}
      <div
        className={cn(
          'absolute rounded-full border-2 transition-colors',
          state === 'error' && 'border-destructive/40',
          state === 'warning' && 'border-destructive/50',
          state === 'recording' && 'border-foreground/25',
          state === 'paused' && 'border-foreground/20',
          state === 'idle' && 'border-border',
        )}
        style={{
          width: `${11 + l * 5}rem`,
          height: `${11 + l * 5}rem`,
          opacity: active ? 0.35 + l * 0.65 : 0.6,
        }}
      />

      {/* Middle ring: slower, gives the level some body without looking like a waveform toy. */}
      <div
        className={cn(
          'absolute rounded-full',
          state === 'error' || state === 'warning' ? 'bg-destructive/10' : 'bg-foreground/5',
        )}
        style={{ width: `${8 + l * 3}rem`, height: `${8 + l * 3}rem` }}
      />

      {/* Core: solid, constant size, so there is always an unambiguous target. */}
      <div
        className={cn(
          'relative grid size-28 place-items-center rounded-full transition-colors',
          state === 'error' || state === 'warning'
            ? 'bg-destructive text-destructive-foreground'
            : state === 'recording'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {state === 'recording' || state === 'warning' ? (
          // A square reads as "stop" to anyone, in any language.
          <span className="size-8 rounded-[4px] bg-current" aria-hidden />
        ) : (
          <span className="size-8 rounded-full bg-current" aria-hidden />
        )}
      </div>
    </div>
  );
}
