import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Play } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Three behaviours as an asymmetric bento: a wide tile, a narrow tile, and a
 * full-width band. Each is a small working model, not an icon with a caption.
 * An Ergänzung types itself into a standing letter, the follow-along highlight
 * walks a transcript in step with a playhead, and the Word file shows the two
 * things a template actually cares about.
 *
 * Every loop runs on its own clock, starts only when the tile is on screen,
 * and stands finished under reduced motion.
 */

function useLoopClock(totalMs: number): { t: number; finished: boolean; ref: React.RefObject<HTMLDivElement | null> } {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFinished(true);
      setT(totalMs);
      return;
    }
    let raf = 0;
    let running = false;
    let started = performance.now();
    let lastStep = -1;
    const tick = () => {
      // Twenty-five updates a second is plenty for typing and word sweeps;
      // rendering React at display rate for three tiles is not.
      const elapsed = (performance.now() - started) % totalMs;
      const step = Math.floor(elapsed / 40);
      if (step !== lastStep) {
        lastStep = step;
        setT(elapsed);
      }
      raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      ([e]) => {
        const should = e?.isIntersecting ?? false;
        if (should && !running) {
          running = true;
          started = performance.now();
          raf = requestAnimationFrame(tick);
        } else if (!should && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.35 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [totalMs]);

  return { t, finished, ref };
}

const typed = (text: string, from: number, to: number, t: number) =>
  text.slice(0, Math.round(Math.min(1, Math.max(0, (t - from) / (to - from))) * text.length));

/* ------------------------------------------------------ wide: ergänzen ---- */

const ERG_LINE = 'Eine Kontrolle in 6 Monaten wurde vereinbart.';

function TileErgaenzen() {
  // No idle phase: the chip is always saying something, so the tile never
  // opens a hole where a hidden chip reserves its space.
  const { t, finished, ref } = useLoopClock(7400);
  const phase = finished ? 'done' : t < 900 ? 'busy' : t < 4300 ? 'typing' : 'done';
  const line = phase === 'busy' ? '' : typed(ERG_LINE, 900, 4100, finished ? 9e9 : t);

  return (
    <div ref={ref} className="grid gap-8 rounded-3xl border border-border bg-background p-7 sm:p-8 lg:col-span-2 lg:grid-cols-2 lg:items-center">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-balance">Nachdiktieren, nicht neu diktieren.</h3>
        <p className="mt-3 max-w-[36ch] text-[0.95rem] leading-relaxed text-muted-foreground">
          Ihnen fällt nach dem Diktat noch etwas ein? Sprechen Sie es nach. Es wird in den stehenden Text eingearbeitet, nicht angehängt.
        </p>
        <div className="mt-5 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm">
          {phase === 'busy' || phase === 'typing' ? (
            <>
              <Spinner className="size-3.5" />
              Die Ergänzung wird eingearbeitet …
            </>
          ) : (
            <>
              <Check className="size-3.5" aria-hidden />
              <span className="font-medium">Eingearbeitet</span>
            </>
          )}
        </div>
      </div>
      <div className="paper-mini px-5 py-4">
        <div className="font-document text-[0.92rem] leading-[1.8]">
          <p className="font-bold underline underline-offset-2">Zusammenfassende Beurteilung</p>
          <p>Unter Belastung keine Angina pectoris; die Belastbarkeit ist gut.</p>
          <p>Die Medikation wurde unverändert fortgeführt.</p>
          <p className={cn('transition-opacity', line ? 'opacity-100' : 'opacity-0')}>
            {line}
            {phase === 'typing' ? <span className="-mb-0.5 inline-block h-[1em] w-[2px] bg-foreground/70" aria-hidden /> : null}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ narrow: follow along ---- */

const FOLLOW_WORDS = 'Der Blutdruck lag heute bei einhundertfünfundvierzig zu neunzig, das EKG war unauffällig.'.split(' ');

function TileFollowAlong() {
  const { t, finished, ref } = useLoopClock(8000);
  const p = finished ? 0.72 : Math.min(1, t / 7200);
  const lit = Math.round(p * FOLLOW_WORDS.length);

  return (
    <div ref={ref} className="flex flex-col rounded-3xl bg-muted p-7 sm:p-8">
      <h3 className="text-2xl font-semibold tracking-tight text-balance">Die Aufnahme liest mit.</h3>
      <p className="mt-3 max-w-[32ch] text-[0.95rem] leading-relaxed text-muted-foreground">
        Beim Abhören läuft die Markierung im Transkript mit. Ein Klick auf ein Wort springt an genau diese Stelle im Ton.
      </p>
      <div className="mt-auto pt-7">
        <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid size-5 place-items-center" aria-hidden>
              <Play className="size-4 fill-current" />
            </span>
            <span className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${p * 100}%` }} />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">0:{String(Math.floor(p * 14)).padStart(2, '0')}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            {FOLLOW_WORDS.map((w, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-[3px] px-px transition-colors duration-150',
                  i === lit - 1 ? 'bg-foreground text-background' : i < lit ? 'text-muted-foreground' : '',
                )}
              >
                {w}{' '}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- band: word file ---- */

function BandWord() {
  return (
    <div className="grid items-center gap-8 rounded-3xl border border-border bg-background p-7 sm:p-8 lg:col-span-3 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <h3 className="text-2xl font-semibold tracking-tight text-balance">Landet in Word, wie er gehört.</h3>
        <p className="mt-3 max-w-[38ch] text-[0.95rem] leading-relaxed text-muted-foreground">
          Echte Überschriften, echte Tabstopps. Die Dosierungsspalten sitzen auf Tabulatoren, nicht auf Leerzeichen. Gesprochene Zahlen werden zu 1-0-0.
        </p>
      </div>
      <div className="lg:col-span-7">
        <div className="paper-mini max-w-[30rem] px-6 py-5 sm:px-8 sm:py-6 lg:ms-auto">
          <div className="font-document text-[0.95rem] leading-[1.85]">
            <p className="font-bold underline underline-offset-2">Aktuelle Therapie</p>
            <TabRow name="ASS 100" dose="1-0-0" />
            <TabRow name="Sevikar 40/5" dose="1-0-0" />
            <TabRow name="Atorvastatin 40" dose="0-0-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A dosing row on a real tab column: name at the margin, dose at the stop. */
function TabRow({ name, dose }: { name: string; dose: string }) {
  return (
    <p className="grid grid-cols-[minmax(0,14ch)_auto] items-baseline">
      <span>{name}</span>
      <span className="relative ps-2 before:absolute before:top-[0.35em] before:bottom-[0.35em] before:left-0 before:w-px before:bg-foreground/15">
        {dose}
      </span>
    </p>
  );
}

/* ----------------------------------------------------------- section ---- */

export function Bento({ heading }: { heading: ReactNode }) {
  return (
    <section className="bg-muted/50 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        {heading}
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <TileErgaenzen />
          <TileFollowAlong />
          <BandWord />
        </div>
      </div>
    </section>
  );
}
