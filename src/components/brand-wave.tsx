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
      mark: true,
      // A HELD pose, not a breathing one. The bands used to swing on slow
      // sines, and because the drift rate is mixed from that same signal the
      // whole figure sped up and slowed down as they moved. Holding them
      // still leaves exactly one thing in motion — the travelling wave — at
      // one unchanging speed.
      probe: () => ({ low: 0.7, mid: 0.26, high: 0.1, level: 0.42 }),
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
