import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { MicLevelSnapshot } from '@/lib/audio/mic-level.ts';
import { RecordingOrb, type OrbState } from './RecordingOrb';
import { WaveEngine } from './wave/engine.ts';
import { recordingSession } from './useRecording';

export interface RecordingWaveProps {
  state: OrbState;
  /** Only used by the fallback indicator when WebGL2 is unavailable. */
  level: number;
  /** Additive glow on a dark surface — the Diktat feature's signature. */
  dark?: boolean;
  className?: string;
}

/**
 * The recording indicator.
 *
 * A ribbon of light drawn in WebGL and driven by the microphone the recorder is
 * already using: the low band sets how far the wave swings, the high band sets
 * how far the four colour copies separate — so a vowel makes it bloom and an
 * "s" makes it fringe — and overall level sets brightness.
 *
 * It reads the same stream the recorder reads. Nothing extra is captured,
 * nothing is transmitted, and while a recording is running the ribbon is never
 * simulated: real input or a flat line. That is the whole job of this component
 * — proving sound is arriving right now — and a decorative animation that runs
 * whether or not the microphone works would answer that question with a guess.
 */
export function RecordingWave({ state, level, dark = false, className }: RecordingWaveProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<MicLevelSnapshot | null>(null);
  const [supported, setSupported] = useState(true);

  // Per-frame audio, kept out of React state on purpose.
  useEffect(() => recordingSession.subscribeAudio((s) => (audioRef.current = s)), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const engine = new WaveEngine(host, {
      reducedMotion: motionQuery.matches,
      dark,
      probe: () => {
        // Dev-only pose override, so the ribbon can be tuned and screenshotted
        // at a given input level without talking into a microphone.
        // ?wave=low,mid,high,level — stripped from production builds.
        if (import.meta.env.DEV) {
          const q = new URLSearchParams(window.location.search).get('wave');
          if (q) {
            const [low = 0, mid = 0, high = 0, lvl = 0] = q.split(',').map(Number);
            return { low, mid, high, level: lvl };
          }
        }
        const s = audioRef.current;
        if (!s) return null;
        return { low: s.low, mid: s.mid, high: s.high, level: s.level };
      },
    });

    if (!engine.ok) {
      engine.destroy();
      setSupported(false);
      return;
    }

    let visible = true;
    let onscreen = true;

    const sync = () => {
      if (visible && onscreen) engine.start();
      else engine.stop();
    };

    const onVisibility = () => {
      visible = document.visibilityState === 'visible';
      sync();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        onscreen = entry?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0 },
    );
    const onMotionChange = () => {
      engine.setReducedMotion(motionQuery.matches);
    };

    observer.observe(host);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);

    engine.renderStill();
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  if (!supported) {
    return <RecordingOrb level={level} state={state} {...(className ? { className } : {})} />;
  }

  const label =
    state === 'recording'
      ? `Aufnahme läuft, Eingangspegel ${Math.round(Math.max(0, Math.min(1, level)) * 100)} Prozent`
      : state === 'paused'
        ? 'Aufnahme pausiert'
        : state === 'warning'
          ? 'Aufnahme läuft, aber es wird kein Ton empfangen'
          : state === 'error'
            ? 'Aufnahme gestoppt, Fehler'
            : 'Bereit zur Aufnahme';

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      className={cn(
        'h-44 w-full max-w-[36rem] select-none',
        // Dimmed rather than recoloured when something is wrong: the red alert
        // beneath carries the message, and tinting the ribbon would fight the
        // one thing it is meant to show.
        (state === 'warning' || state === 'error') && 'opacity-40',
        // Paused sits clearly above the fault states and clearly below live, so
        // "held on purpose" never reads as "something broke". The ribbon has
        // already flattened on its own — no audio is arriving, because none is
        // being captured — and this only says that the stillness is intended.
        state === 'paused' && 'opacity-65',
        'transition-opacity duration-500 ease-out',
        className,
      )}
    />
  );
}
