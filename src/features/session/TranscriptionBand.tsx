import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { PROGRESS_CEILING } from './processing-handoff-model';
import { findWordBreaks } from './recording-shape';

/**
 * The recording turning into writing, left to right.
 *
 * Ahead of the reading head the band stands as the outline of his recording;
 * behind it the same marks have settled into a line of text, and where he
 * paused while speaking the line leaves a word space. In the drafting phase
 * the material is already text and the head passes again, darkening what has
 * been composed.
 *
 * Drawn on a canvas rather than as elements, and that is the whole reason it
 * is smooth. The first version of this was 128 nodes each carrying a CSS
 * transition — including background-colour, which is painted, not composited
 * — all flipping together whenever a once-a-second React tick moved the head.
 * It stuttered because of how it was rendered, not because of what it showed.
 * Here one loop redraws every frame from the real clock, so the head advances
 * continuously and the marks melt across a soft front instead of snapping.
 */

/** Width of the melt zone behind the head, as a fraction of the band. */
const MORPH = 0.07;
/** Half-height of a settled mark, in CSS pixels. */
const TEXT_HALF = 1.4;
/** Keeps the drawing off the canvas edge so nothing looks sheared off. */
const INSET = 1;

export function TranscriptionBand({
  shape,
  startedAt,
  estimateMs,
  drafting,
  className,
}: {
  shape: number[];
  startedAt: number;
  estimateMs: number;
  drafting: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Read by the frame loop; never triggers a React render.
  const dataRef = useRef({ shape, startedAt, estimateMs, drafting });
  dataRef.current = { shape, startedAt, estimateMs, drafting };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let ink: [number, number, number] = [10, 10, 10];

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The ink colour is whatever the page says text is, so the band follows
      // the theme without hard-coding a value the tokens could move out from.
      const parsed = getComputedStyle(canvas).color.match(/\d+(\.\d+)?/g);
      if (parsed && parsed.length >= 3) {
        ink = [Number(parsed[0]), Number(parsed[1]), Number(parsed[2])];
      }
    };

    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

    const draw = () => {
      const { shape: s, startedAt: from, estimateMs: est, drafting: isDraft } = dataRef.current;
      ctx.clearRect(0, 0, width, height);
      if (width <= 0 || s.length === 0) return;

      const elapsed = Math.max(0, Date.now() - from);
      const progress = est > 0 ? clamp01(elapsed / est) * PROGRESS_CEILING : 0;

      const mid = height / 2;
      const usable = width - INSET * 2;
      const slot = usable / s.length;
      const maxHalf = height / 2 - 2;
      const [r, g, b] = ink;
      const breaks = findWordBreaks(s);
      const headX = INSET + progress * usable;
      const meltPx = MORPH * usable;

      /**
       * Settled writing, drawn one stroke per word rather than one mark per
       * sample. Butting 128 separate pills up against each other and hoping
       * they touch is what made this read as a dashed rule: at a five-pixel
       * slot the seams are as wide as the marks.
       */
      const drawWords = (upToX: number, fill: string | CanvasGradient) => {
        ctx.fillStyle = fill;
        let runStart = -1;
        for (let i = 0; i <= s.length; i += 1) {
          const isInk = i < s.length && !(breaks[i] ?? false);
          if (isInk && runStart === -1) runStart = i;
          if (!isInk && runStart !== -1) {
            const x0 = INSET + runStart * slot;
            // A hair of air at the end of each word, so words stay countable.
            const x1 = Math.min(INSET + i * slot - slot * 0.35, upToX);
            if (x1 > x0) {
              ctx.beginPath();
              ctx.roundRect(x0, mid - TEXT_HALF, Math.max(x1 - x0, TEXT_HALF * 2), TEXT_HALF * 2, TEXT_HALF);
              ctx.fill();
            }
            runStart = -1;
          }
        }
      };

      if (isDraft) {
        // Already writing; the head darkens what has been composed, with a
        // soft front so the change of ink is not a hard edge.
        drawWords(width, `rgba(${r}, ${g}, ${b}, 0.34)`);
        const grad = ctx.createLinearGradient(Math.max(0, headX - meltPx), 0, headX, 0);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        drawWords(headX, grad);
      } else {
        // Everything the head has passed is writing; the rest is still sound,
        // with the marks melting between the two across the front.
        drawWords(Math.max(0, headX - meltPx), `rgba(${r}, ${g}, ${b}, 0.62)`);

        for (let i = 0; i < s.length; i += 1) {
          const value = s[i] ?? 0;
          const pos = s.length > 1 ? i / (s.length - 1) : 0;
          const lead = clamp01((progress - pos) / MORPH);
          if (lead >= 1) continue; // already covered by the settled writing
          const isPause = breaks[i] ?? false;

          const soundHalf = Math.max(value, 0.06) * maxHalf;
          const half = mix(soundHalf, TEXT_HALF, lead);
          const barWidth = mix(slot * 0.46, slot * 0.9, lead);
          const alpha = mix(1, isPause ? 0 : 0.62, lead);
          if (alpha <= 0.01) continue;

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          const x = INSET + i * slot + (slot - barWidth) / 2;
          ctx.beginPath();
          ctx.roundRect(x, mid - half, barWidth, half * 2, Math.min(barWidth / 2, half));
          ctx.fill();
        }
      }

      // The reading head: brightest on the centre line, fading at the edges so
      // it reads as a place in the text rather than a bar across a chart.
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.55)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(Math.round(headX) + 0.5, 0, 1, height);
    };

    let raf = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const startLoop = () => {
      stopLoop();
      if (motionQuery.matches) {
        // Reduced motion: still truthful, just not animated — the head steps
        // rather than glides. An indicator that cannot update at all would
        // stop answering "is it still working?".
        draw();
        timer = setInterval(draw, 1000);
        return;
      }
      const tick = () => {
        draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const stopLoop = () => {
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
      timer = null;
    };

    measure();
    startLoop();

    const ro = new ResizeObserver(() => {
      measure();
      draw();
    });
    ro.observe(canvas);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') startLoop();
      else stopLoop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', startLoop);

    return () => {
      stopLoop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', startLoop);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('w-full text-foreground', className)}
    />
  );
}
