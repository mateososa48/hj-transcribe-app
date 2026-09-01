import { useEffect, useRef, useState } from 'react';

import { WaveEngine } from '@/features/record/wave/engine';
import { cn } from '@/lib/utils';

/**
 * The app's actual recording ribbon — the same WebGL shader the product runs —
 * mounted on the landing page and fed a synthetic speech envelope instead of a
 * microphone. Nothing here is a video or an export: it is the instrument
 * itself, breathing on the page that sells it.
 *
 * The envelope imitates dictation rather than music: bursts of syllables at a
 * talking cadence, short breaths between phrases, a longer pause at the end of
 * a "sentence". All values are smoothed so the ribbon swells and settles the
 * way it does when someone actually speaks.
 *
 * Same discipline as the in-app mark: paused offscreen and on hidden tabs,
 * a still frame under reduced motion, absent without WebGL2.
 */
export function LiveRibbon({ dark = false, className }: { dark?: boolean; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();

    // Smoothed state, so bursts never snap.
    let level = 0;
    let low = 0;
    let high = 0;
    let last = started;

    const engine = new WaveEngine(host, {
      reducedMotion: false,
      dark,
      probe: () => {
        const now = performance.now();
        const t = (now - started) / 1000;
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        // Phrases: ~70% talking, with breaths. Two slow sines beat against
        // each other so the pattern never visibly repeats.
        const phrase = Math.sin(t * 0.43) + Math.sin(t * 0.19 + 1.7);
        const speaking = phrase > -0.35 ? 1 : 0;
        // Syllables at a talking cadence, only while speaking.
        const syllable = Math.max(0, Math.sin(t * 10.7) * 0.6 + Math.sin(t * 6.1 + 0.8) * 0.4);
        const target = speaking * (0.32 + 0.5 * syllable);

        // Attack fast, release slow — how a voice actually meets a meter.
        const rate = target > level ? 9 : 3.2;
        level += (target - level) * Math.min(1, rate * dt);
        low += (speaking * (0.45 + 0.25 * Math.sin(t * 1.3)) - low) * Math.min(1, 4 * dt);
        high += (speaking * Math.max(0, Math.sin(t * 13.7)) * 0.5 - high) * Math.min(1, 6 * dt);

        return { low, mid: level * 0.5, high, level };
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
  }, [dark]);

  if (!supported) return null;

  return <div ref={hostRef} aria-hidden className={cn('select-none', className)} />;
}
