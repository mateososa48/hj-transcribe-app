import { useEffect, useRef, useState } from 'react';

import { WaveEngine } from '@/features/record/wave/engine';
import { cn } from '@/lib/utils';
import { createSpeechEnvelope, type SpeechFrame } from './speech';

/**
 * The app's actual recording ribbon, the same WebGL shader the product runs,
 * mounted on the landing page and fed a synthetic speech envelope instead of a
 * microphone. Nothing here is a video or an export: it is the instrument
 * itself, breathing on the page that sells it.
 *
 * By default each ribbon carries its own envelope. Pass `probe` to make it
 * listen to a shared voice instead (the hero ribbon listens to the demo).
 *
 * Same discipline as the in-app mark: paused offscreen and on hidden tabs,
 * a still frame under reduced motion, absent without WebGL2.
 */
export function LiveRibbon({
  dark = false,
  probe,
  className,
}: {
  dark?: boolean;
  probe?: () => SpeechFrame;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const own = createSpeechEnvelope();
    const read = probe ?? (() => own(performance.now()));

    const engine = new WaveEngine(host, {
      reducedMotion: false,
      dark,
      probe: read,
    });

    if (!engine.ok) {
      engine.destroy();
      setSupported(false);
      return;
    }

    let visible = true;
    let onscreen = true;
    const sync = () => {
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
  }, [dark, probe]);

  if (!supported) return null;

  return <div ref={hostRef} aria-hidden className={cn('select-none', className)} />;
}
