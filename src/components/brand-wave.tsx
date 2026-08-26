import { useEffect, useRef, useState } from 'react';

import { WaveEngine } from '@/features/record/wave/engine';
import { cn } from '@/lib/utils';

/**
 * The app mark: the recording ribbon, miniature and ambient. It runs on slow
 * synthetic swells instead of the microphone — long, quiet sine periods so it
 * breathes rather than performs. Purely decorative: hidden from assistive
 * tech, a still image under reduced motion, absent without WebGL2, and paused
 * whenever it is offscreen or the tab is hidden.
 */
export function BrandWave({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const engine = new WaveEngine(host, {
      reducedMotion: false,
      probe: () => {
        // Periods of 24–48 seconds: the ribbon should read as alive on a
        // second look, not catch the eye on the first.
        const t = performance.now() / 1000;
        // High baselines, slow change: the ribbon stays ARCED — a full,
        // rounded figure, not a resting line — while barely drifting.
        return {
          low: 0.62 + 0.14 * Math.sin(t * 0.21),
          mid: 0.3 + 0.1 * Math.sin(t * 0.13 + 1.4),
          high: 0.12 + 0.06 * Math.sin(t * 0.17 + 2.3),
          level: 0.44 + 0.1 * Math.sin(t * 0.09 + 0.6),
        };
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
      // Decoration must not move for people who asked motion to stop.
      if (motionQuery.matches) {
        engine.stop();
        engine.renderStill();
        return;
      }
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

    observer.observe(host);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', sync);

    engine.renderStill();
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', sync);
      engine.destroy();
    };
  }, []);

  if (!supported) return null;

  return <div ref={hostRef} aria-hidden className={cn('select-none', className)} />;
}
