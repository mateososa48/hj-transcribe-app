import { useEffect, useRef, useState } from 'react';
import { Check, Mic } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { createSpeechEnvelope } from './speech';

/**
 * The product, running in the hero.
 *
 * Not a video and not a screenshot: the app's own grammar rebuilt small — the
 * recording window with a live meter and a running clock, the spoken words
 * arriving as they are recognised, the letter beneath assembling itself in the
 * document face, and the app's real job-chip filing the result. One rAF clock
 * drives the whole scene, so scrubbing feels like watching one machine work
 * rather than four animations that happen to be neighbours.
 *
 * The dosing line is the whole product in one beat: "eins null null" is what
 * was SAID, "1-0-0" is what lands in the letter.
 */

const SPOKEN_WORDS = 'Aktuelle Therapie: ASS hundert eins null null, Clopidogrel fünfundsiebzig eins null null bis Mai sechsundzwanzig.'.split(' ');

const LETTER_LINES = [
  { text: 'Aktuelle Therapie', heading: true },
  { text: 'ASS 100   1-0-0' },
  { text: 'Clopidogrel 75  1-0-0 bis 5/26' },
];

/** Scene timeline, in ms on the shared clock. */
const T = {
  speakStart: 400,
  speakEnd: 4400,
  press: 4700,
  jobStart: 5000,
  writeStart: 5600,
  writeEnd: 7400,
  jobDone: 7600,
  hold: 9800,
  total: 10600,
};

const BAR_COUNT = 24;

interface Scene {
  t: number;
  speaking: boolean;
  spokenCount: number;
  pressed: boolean;
  job: 'none' | 'busy' | 'done';
  charsWritten: number;
  fade: number;
}

function sceneAt(t: number): Scene {
  const speaking = t >= T.speakStart && t < T.speakEnd;
  const speakP = Math.min(1, Math.max(0, (t - T.speakStart) / (T.speakEnd - T.speakStart)));
  const writeP = Math.min(1, Math.max(0, (t - T.writeStart) / (T.writeEnd - T.writeStart)));
  const totalChars = LETTER_LINES.reduce((n, l) => n + l.text.length, 0);
  return {
    t,
    speaking,
    spokenCount: Math.round(speakP * SPOKEN_WORDS.length),
    pressed: t >= T.press,
    job: t < T.jobStart ? 'none' : t < T.jobDone ? 'busy' : 'done',
    charsWritten: Math.round(writeP * totalChars),
    // Ease everything out at the end of the loop instead of hard-cutting.
    fade: t > T.hold ? Math.min(1, (t - T.hold) / (T.total - T.hold)) : 0,
  };
}

const FINISHED: Scene = {
  t: T.hold,
  speaking: false,
  spokenCount: SPOKEN_WORDS.length,
  pressed: true,
  job: 'done',
  charsWritten: LETTER_LINES.reduce((n, l) => n + l.text.length, 0),
  fade: 0,
};

export function HeroDemo({ className }: { className?: string }) {
  const [scene, setScene] = useState<Scene>(() => sceneAt(0));
  const [reduced, setReduced] = useState(false);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      setReduced(true);
      setScene(FINISHED);
      return;
    }

    const envelope = createSpeechEnvelope();
    let raf = 0;
    let running = false;
    let started = performance.now();

    const tick = () => {
      const now = performance.now();
      const t = (now - started) % T.total;
      const s = sceneAt(t);
      setScene((prev) =>
        prev.spokenCount === s.spokenCount &&
        prev.pressed === s.pressed &&
        prev.job === s.job &&
        prev.charsWritten === s.charsWritten &&
        prev.fade === s.fade
          ? prev
          : s,
      );
      // The meter runs outside React: 24 bars at display rate.
      const frame = envelope(now, s.speaking);
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const phase = Math.sin(now / 90 + i * 1.7) * 0.5 + 0.5;
        const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
        const h = 0.16 + frame.level * (0.45 + 0.85 * phase) * (0.35 + 0.65 * center) * 1.15;
        bar.style.transform = `scaleY(${Math.min(1, h)})`;
      });
      raf = requestAnimationFrame(tick);
    };

    const sync = (onscreen: boolean) => {
      const should = onscreen && document.visibilityState === 'visible';
      if (should && !running) {
        running = true;
        started = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    const observer = new IntersectionObserver(([e]) => sync(e?.isIntersecting ?? true), {
      threshold: 0.15,
    });
    const onVisibility = () => sync(running);
    if (hostRef.current) observer.observe(hostRef.current);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Distribute written characters across the letter lines.
  let remaining = scene.charsWritten;
  const lines = LETTER_LINES.map((line) => {
    const shown = Math.max(0, Math.min(line.text.length, remaining));
    remaining -= shown;
    return { ...line, shown };
  });

  return (
    <div
      ref={hostRef}
      aria-label="So arbeitet der Arzt-Assistent: ein Diktat wird zum Briefabschnitt"
      role="img"
      className={cn('relative select-none', className)}
      style={{ opacity: 1 - scene.fade * 0.9 }}
    >
      {/* The recording window — the app's own floating recorder, small. */}
      <div className="relative z-10 mx-auto flex w-fit max-w-full flex-col rounded-2xl border border-border bg-card px-5 py-3.5 shadow-2xl">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-32 items-center justify-between gap-[2.5px]" aria-hidden>
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  barsRef.current[i] = el;
                }}
                className="w-[3.5px] origin-center rounded-full bg-foreground/70"
                style={{ height: '100%', transform: 'scaleY(0.12)' }}
              />
            ))}
          </span>
          <span className="text-xl font-semibold tracking-tight tabular-nums">
            0:{String(Math.min(59, Math.floor(Math.min(scene.t, T.speakEnd) / 1000))).padStart(2, '0')}
          </span>
          <span
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-white transition-transform duration-150',
              scene.pressed && !reduced && 'scale-[0.96]',
            )}
          >
            <Check className="size-4" aria-hidden />
            Fertig
          </span>
        </div>
        <p className="mt-1 self-end pe-1 text-xs text-muted-foreground">In „Aktuelle Therapie"</p>
      </div>

      {/* What was heard, streaming in as it is recognised. */}
      <p className="mx-auto mt-5 min-h-[3.5rem] max-w-[52ch] text-center text-[0.95rem] leading-relaxed text-muted-foreground">
        <Mic className="me-1.5 inline size-3.5 -translate-y-px" aria-hidden />
        {SPOKEN_WORDS.map((w, i) => (
          <span
            key={i}
            className={cn(
              'transition-opacity duration-200',
              i < scene.spokenCount ? 'opacity-100' : 'opacity-0',
            )}
          >
            {w}{' '}
          </span>
        ))}
      </p>

      {/* The letter, assembling itself in the document face. */}
      <div className="paper-mini relative mx-auto -mt-1 max-w-xl px-8 py-7 sm:px-10 sm:py-8">
        <div className="font-document text-[1.05rem] leading-[1.9] sm:text-lg">
          {lines.map((line) => (
            <p
              key={line.text}
              className={cn(
                'min-h-[1.9em] whitespace-pre',
                line.heading && 'font-bold underline underline-offset-4',
              )}
            >
              {line.text.slice(0, line.shown)}
              {line.shown > 0 && line.shown < line.text.length ? (
                <span className="-mb-0.5 inline-block h-[1.1em] w-[2px] translate-y-1 bg-foreground/70" aria-hidden />
              ) : null}
            </p>
          ))}
        </div>

        {/* The app's real job-chip, filing the dictation. */}
        <div
          className={cn(
            'absolute -right-3 -bottom-4 flex items-center gap-2.5 rounded-xl border border-border bg-card py-2 ps-3 pe-3.5 shadow-lg transition-all duration-300 sm:-right-6',
            scene.job === 'none' ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
          )}
        >
          {scene.job === 'done' ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-3.5" aria-hidden />
            </span>
          ) : (
            <Spinner className="size-4" />
          )}
          <span className={cn('text-sm', scene.job === 'done' && 'font-medium')}>
            {scene.job === 'done' ? 'In „Aktuelle Therapie" eingefügt' : '„Aktuelle Therapie" wird geschrieben …'}
          </span>
        </div>
      </div>
    </div>
  );
}
