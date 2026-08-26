import { useEffect, useRef, useState } from 'react';

import { WaveEngine } from '@/features/record/wave/engine.ts';
import { cn } from '@/lib/utils';
import { PROGRESS_CEILING } from './processing-handoff-model';

/**
 * The ribbon, replaying the recording it is working through.
 *
 * The recorder's indicator and this one are the same instrument: the same
 * WebGL ribbon, the same shader, the same four phase-shifted copies whose
 * separation reads as sibilance. The only difference is where the signal
 * comes from — a microphone there, and here the outline of the recording
 * already on disk, walked through at the pace of the work.
 *
 * That distinction matters and is the reason this is allowed to exist.
 * DESIGN.md forbids the ribbon from ever being simulated WHILE RECORDING,
 * because there its whole job is to answer "is it hearing me?" and a
 * decorative animation would answer that with a guess. Nothing is being
 * recorded here; this is the same real material played back, so the rule it
 * protects is untouched.
 *
 * Everything moves inside the engine's own frame loop, reading refs. No React
 * state changes per frame — a component that re-rendered on a timer is what
 * made the first attempt at this screen stutter.
 */
export function ProcessingWave({
  shape,
  startedAt,
  estimateMs,
  className,
  onUnsupported,
}: {
  shape: number[];
  startedAt: number;
  estimateMs: number;
  className?: string;
  onUnsupported: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState(true);

  // Live inputs for the frame loop, deliberately outside React state.
  const dataRef = useRef({ shape, startedAt, estimateMs });
  dataRef.current = { shape, startedAt, estimateMs };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const engine = new WaveEngine(host, {
      reducedMotion: motionQuery.matches,
      probe: () => {
        const { shape: s, startedAt: from, estimateMs: est } = dataRef.current;
        if (s.length === 0 || est <= 0) return null;

        const elapsed = Math.max(0, Date.now() - from);
        const progress = Math.min(elapsed / est, 1) * PROGRESS_CEILING;

        // Read between samples: at 60 fps the head crosses a chunk boundary
        // every couple of seconds, and stepping there is exactly the jitter
        // this component exists to avoid.
        const at = progress * (s.length - 1);
        const i = Math.floor(at);
        const t = at - i;
        const a = s[i] ?? 0;
        const b = s[Math.min(i + 1, s.length - 1)] ?? a;
        const level = a + (b - a) * t;

        // How fast the outline is changing stands in for the high band: a
        // steep edge is where consonants live, and the ribbon fringes on it.
        const ahead = s[Math.min(i + 2, s.length - 1)] ?? b;
        const slope = Math.min(1, Math.abs(ahead - a) * 3.5);

        return { low: level, mid: level * 0.82, high: slope, level };
      },
    });

    if (!engine.ok) {
      engine.destroy();
      setSupported(false);
      onUnsupported();
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
    const onMotionChange = () => engine.setReducedMotion(motionQuery.matches);

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
  }, []);

  if (!supported) return null;

  return <div ref={hostRef} aria-hidden className={cn('w-full select-none', className)} />;
}
