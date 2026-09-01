import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, FileDown, Mic, Play } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Three tiles, each a small working model of one product behaviour — not an
 * icon with a caption. An Ergänzung types itself into a standing letter, the
 * follow-along highlight walks a transcript in step with a playhead, and the
 * Word file shows the two things his template actually cares about.
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
    const tick = () => {
      setT((performance.now() - started) % totalMs);
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

/* ------------------------------------------------------------- tile 1 ---- */

const ERG_LINE = 'Eine Kontrolle in 6 Monaten wurde vereinbart.';

function TileErgaenzen() {
  const { t, finished, ref } = useLoopClock(9000);
  const phase = finished ? 'done' : t < 1800 ? 'idle' : t < 2600 ? 'busy' : t < 6200 ? 'typing' : t < 8200 ? 'done' : 'idle';
  const line = phase === 'idle' && !finished ? '' : typed(ERG_LINE, 2600, 6000, finished ? 9e9 : t);

  return (
    <Tile
      ref={ref}
      eyebrow="Ergänzen"
      title="Nachdiktieren, nicht neu diktieren."
      body="Ihnen fällt nach dem Diktat noch etwas ein? Sprechen Sie es einfach nach — es wird in den stehenden Text eingearbeitet."
    >
      <div className="paper-mini px-5 py-4">
        <div className="font-document text-[0.9rem] leading-[1.8]">
          <p>• Unter Belastung keine Angina pectoris; die Belastbarkeit ist gut.</p>
          <p>• Die Medikation wurde unverändert fortgeführt.</p>
          <p className={cn('transition-opacity', line ? 'opacity-100' : 'opacity-0')}>
            • {line}
            {phase === 'typing' ? (
              <span className="-mb-0.5 inline-block h-[1em] w-[2px] bg-foreground/70" aria-hidden />
            ) : null}
          </p>
        </div>
      </div>
      <div
        className={cn(
          'mt-3 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm transition-opacity duration-300',
          phase === 'idle' ? 'opacity-0' : 'opacity-100',
        )}
      >
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
    </Tile>
  );
}

/* ------------------------------------------------------------- tile 2 ---- */

const FOLLOW_WORDS = 'Der Blutdruck lag heute bei einhundertfünfundvierzig zu neunzig, das EKG war unauffällig.'.split(' ');

function TileFollowAlong() {
  const { t, finished, ref } = useLoopClock(8000);
  const p = finished ? 0.72 : Math.min(1, t / 7200);
  const lit = Math.round(p * FOLLOW_WORDS.length);

  return (
    <Tile
      ref={ref}
      eyebrow="Wort für Wort"
      title="Die Aufnahme liest mit."
      body="Beim Abhören läuft die Markierung im Transkript mit. Ein Klick auf ein Wort springt an genau diese Stelle im Ton."
    >
      <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-5 place-items-center" aria-hidden>
            <Play className="size-4 fill-current" />
          </span>
          <span className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${p * 100}%` }} />
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            0:{String(Math.floor(p * 14)).padStart(2, '0')}
          </span>
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
    </Tile>
  );
}

/* ------------------------------------------------------------- tile 3 ---- */

function TileWord() {
  const { ref } = useLoopClock(1);
  return (
    <Tile
      ref={ref}
      eyebrow="Word-Datei"
      title="Landet in Word, wie er gehört."
      body="Der Export trägt echte Überschriften und echte Tabstopps — die Dosierungs­spalten sitzen auf Tabulatoren, nicht auf Leerzeichen."
    >
      <div className="paper-mini px-5 py-4 transition-transform duration-300 hover:-rotate-1">
        <div className="font-document text-[0.9rem] leading-[1.8]">
          <p className="font-bold underline underline-offset-2">Aktuelle Therapie</p>
          <p className="whitespace-pre">ASS 100{'   '}1-0-0</p>
          <p className="whitespace-pre">Sevikar 40/5{'  '}1-0-0</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm">
          <FileDown className="size-3.5" aria-hidden />
          Echte Überschriften
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm">
          <Mic className="size-3.5" aria-hidden />
          Gesprochene Zahlen werden 1-0-0
        </span>
      </div>
    </Tile>
  );
}

/* --------------------------------------------------------------- frame --- */

const Tile = forwardRef<HTMLDivElement, {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}>(function Tile({ eyebrow, title, body, children }, ref) {
  return (
    <div
      ref={ref}
      className="flex h-full flex-col rounded-2xl border border-border bg-background p-6 shadow-[0_1px_2px_rgba(12,12,13,0.04),0_16px_40px_-24px_rgba(12,12,13,0.18)] sm:p-7"
    >
      <p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 mb-5 max-w-[40ch] text-[0.95rem] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
});

export function Bento() {
  return (
    <section className="bg-muted/50 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 className="max-w-[26ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Die Details, an denen man <em className="font-document italic">Sorgfalt</em> erkennt.
        </h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <TileErgaenzen />
          <TileFollowAlong />
          <TileWord />
        </div>
      </div>
    </section>
  );
}
