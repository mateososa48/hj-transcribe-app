import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, FileText, Play } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { LiveRibbon } from './LiveRibbon';
import { createSpeechEnvelope, type SpeechFrame } from './speech';

/**
 * Three behaviours as an asymmetric bento: a wide tile, a narrow tile, and a
 * full-width band. Each stages a real moment from the app rather than an icon
 * with a caption.
 *
 * Ergänzen: the recording window opens on a standing letter, the addition is
 * spoken, filed, and slid into the middle of the text, not appended. Wort für
 * Wort: the mini player runs and the transcript's highlight keeps pace with
 * it. Word: the letter's dosing rows sit on real tab stops, and the file
 * itself is produced at the end.
 *
 * Every loop runs on its own clock, starts only when the tile is on screen,
 * and stands finished under reduced motion.
 */

const SILENCE: SpeechFrame = { low: 0, mid: 0, high: 0, level: 0 };

function useLoopClock(totalMs: number, speaking?: (t: number) => boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef<SpeechFrame>(SILENCE);
  const probe = useCallback(() => frame.current, []);
  const [t, setT] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFinished(true);
      setT(totalMs);
      return;
    }
    const envelope = createSpeechEnvelope();
    let raf = 0;
    let running = false;
    let started = performance.now();
    let lastStep = -1;
    const tick = () => {
      const now = performance.now();
      const elapsed = (now - started) % totalMs;
      frame.current = envelope(now, speaking ? speaking(elapsed) : false);
      // Twenty-five updates a second is plenty for typing and word sweeps.
      const step = Math.floor(elapsed / 40);
      if (step !== lastStep) {
        lastStep = step;
        setT(elapsed);
      }
      raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      ([e]) => {
        const should = (e?.isIntersecting ?? false) && document.visibilityState === 'visible';
        if (should && !running) {
          running = true;
          started = performance.now();
          raf = requestAnimationFrame(tick);
        } else if (!should && running) {
          running = false;
          cancelAnimationFrame(raf);
          frame.current = SILENCE;
        }
      },
      { threshold: 0.35 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      frame.current = SILENCE;
    };
  }, [totalMs, speaking]);

  return { t, finished, ref, probe };
}

/* ------------------------------------------------------ wide: ergänzen ---- */

const ERG_SAID = 'Eine Kontrolle in sechs Monaten wurde vereinbart.'.split(' ');
const ERG_LINE = 'Eine Kontrolle in 6 Monaten wurde vereinbart.';
const E = { speakEnd: 2600, press: 2800, busy: 3000, insert: 3900, done: 5300, hold: 8600, total: 9600 };
const ergSpeaking = (t: number) => t > 300 && t < E.speakEnd;

function TileErgaenzen() {
  const reduce = useReducedMotion();
  const { t, finished, ref, probe } = useLoopClock(E.total, ergSpeaking);
  const said = finished ? ERG_SAID.length : Math.round(Math.min(1, Math.max(0, (t - 300) / (E.speakEnd - 300))) * ERG_SAID.length);
  const pressed = finished || t >= E.press;
  const job: 'none' | 'busy' | 'done' = finished ? 'done' : t < E.busy ? 'none' : t < E.done ? 'busy' : 'done';
  const inserted = finished || (t >= E.insert && t < E.hold);
  const fresh = !finished && t >= E.insert && t < E.insert + 1400;
  const seconds = Math.min(59, Math.floor(Math.min(t, E.speakEnd) / 1000));

  return (
    <div ref={ref} className="grid gap-8 rounded-3xl border border-border bg-background p-7 sm:p-8 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
      <div className="min-w-0">
        <h3 className="text-[1.35rem] leading-tight font-semibold tracking-tight text-balance">Nachdiktieren, nicht neu diktieren.</h3>
        <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-relaxed text-muted-foreground">
          Ihnen fällt nach dem Diktat noch etwas ein? Sprechen Sie es nach. Es wird in den stehenden Text eingearbeitet, an der Stelle, an die es gehört.
        </p>

        {/* The app's recording window, small. */}
        <div className="mt-6 flex w-fit max-w-full flex-col rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_1px_2px_rgba(12,12,13,0.05),0_18px_40px_-24px_rgba(217,42,104,0.3)]">
          <div className="flex items-center gap-3">
            <LiveRibbon probe={probe} className="h-8 w-24 shrink-0" />
            <span className="text-base font-semibold tracking-tight tabular-nums">0:{String(seconds).padStart(2, '0')}</span>
            <span
              className={cn(
                'btn-liquid-dark flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-white transition-transform duration-150',
                pressed && !reduce && !finished && t < E.press + 400 && 'scale-[0.94]',
              )}
            >
              <Check className="size-3" aria-hidden />
              Fertig
            </span>
          </div>
          <p className="mt-0.5 self-end pe-0.5 text-[11px] text-muted-foreground">In „Zusammenfassende Beurteilung"</p>
        </div>
        <p className="mt-3 min-h-[2.6em] max-w-[34ch] text-[0.85rem] leading-relaxed text-muted-foreground">
          {ERG_SAID.map((w, i) => (
            <span key={i} className={cn('transition-opacity duration-150', i < said ? 'opacity-100' : 'opacity-0')}>
              {w}{' '}
            </span>
          ))}
        </p>
      </div>

      {/* The standing letter, receiving the addition where it belongs. */}
      <div className="relative min-w-0">
        <div className="paper-mini px-5 py-4 sm:px-6 sm:py-5">
          <div className="font-document text-[0.92rem] leading-[1.8]">
            <p className="font-bold underline underline-offset-2">Zusammenfassende Beurteilung</p>
            <p>Unter Belastung keine Angina pectoris; die Belastbarkeit ist gut.</p>
            <AnimatePresence initial={false}>
              {inserted ? (
                <motion.p
                  key="insert"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  className="overflow-hidden"
                >
                  <span className={cn('-mx-1 rounded-[3px] px-1 transition-colors duration-1000', fresh ? 'bg-[#4230ff]/12' : 'bg-transparent')}>
                    {ERG_LINE}
                  </span>
                </motion.p>
              ) : null}
            </AnimatePresence>
            <p>Die Medikation wurde unverändert fortgeführt.</p>
          </div>
        </div>
        {/* The app's job chip, filing the addition. */}
        <div
          className={cn(
            'absolute -right-2 -bottom-3 flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 ps-2.5 pe-3 text-xs shadow-md transition-[opacity,transform] duration-300 sm:-right-4',
            job === 'none' ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
          )}
        >
          {job === 'done' ? (
            <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-2.5" aria-hidden />
            </span>
          ) : (
            <Spinner className="size-3.5" />
          )}
          <span className={cn(job === 'done' && 'font-medium')}>{job === 'done' ? 'Eingearbeitet' : 'Wird eingearbeitet …'}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ narrow: follow along ---- */

const FOLLOW_WORDS = 'Der Blutdruck lag heute bei einhundertfünfundvierzig zu neunzig, das EKG war unauffällig.'.split(' ');
const FOLLOW_MS = 7200;

function TileFollowAlong() {
  const { t, finished, ref } = useLoopClock(FOLLOW_MS + 1400);
  const p = finished ? 0.72 : Math.min(1, t / FOLLOW_MS);
  const lit = Math.round(p * FOLLOW_WORDS.length);
  const secs = Math.floor(p * 14);

  return (
    <div ref={ref} className="flex min-w-0 flex-col rounded-3xl border border-border bg-muted/60 p-7 sm:p-8">
      <h3 className="text-[1.35rem] leading-tight font-semibold tracking-tight text-balance">Die Aufnahme liest mit.</h3>
      <p className="mt-3 max-w-[30ch] text-[0.95rem] leading-relaxed text-muted-foreground">
        Beim Abhören läuft die Markierung im Transkript mit. Ein Klick auf ein Wort springt an genau diese Stelle im Ton.
      </p>
      <div className="mt-auto pt-7">
        {/* The app's mini player and, under it, the words it produced. */}
        <div className="rounded-2xl bg-background p-4 shadow-[0_1px_2px_rgba(12,12,13,0.05),0_16px_40px_-28px_rgba(12,12,13,0.3)]">
          <div className="flex items-center gap-3">
            <span className="grid size-6 shrink-0 place-items-center" aria-hidden>
              <Play className="size-4 fill-current" />
            </span>
            <span className="relative h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/12">
              <span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${p * 100}%` }} />
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              0:{String(secs).padStart(2, '0')} <span className="text-muted-foreground/60">/ 0:14</span>
            </span>
          </div>
          <p className="mt-3.5 text-sm leading-[1.7]">
            {FOLLOW_WORDS.map((w, i) => (
              <span
                key={i}
                className={cn(
                  '-mx-px rounded-[3px] px-px transition-colors duration-150',
                  i === lit - 1 ? 'bg-foreground text-background' : i < lit ? 'text-foreground' : 'text-muted-foreground',
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

const W = { file: 2200, hold: 6400, total: 7200 };

function BandWord() {
  const reduce = useReducedMotion();
  const { t, finished, ref } = useLoopClock(W.total);
  const filed = finished || (t >= W.file && t < W.hold);

  return (
    <div ref={ref} className="grid items-center gap-8 rounded-3xl border border-border bg-background p-7 sm:p-8 lg:col-span-3 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-5">
        <h3 className="text-[1.35rem] leading-tight font-semibold tracking-tight text-balance">Landet in Word, wie er gehört.</h3>
        <p className="mt-3 max-w-[38ch] text-[0.95rem] leading-relaxed text-muted-foreground">
          Echte Überschriften, echte Tabstopps. Die Dosierungsspalten sitzen auf Tabulatoren, nicht auf Leerzeichen, und überleben jede Bearbeitung in Word.
        </p>
      </div>
      <div className="relative min-w-0 lg:col-span-7">
        <div className="paper-mini max-w-[30rem] px-6 py-5 sm:px-8 sm:py-6 lg:ms-auto">
          <div className="font-document text-[0.95rem] leading-[1.85]">
            <p className="font-bold underline underline-offset-2">Aktuelle Therapie</p>
            <TabRow name="ASS 100" dose="1-0-0" />
            <TabRow name="Sevikar 40/5" dose="1-0-0" />
            <TabRow name="Atorvastatin 40" dose="0-0-1" />
          </div>
        </div>
        {/* The file, produced. */}
        <AnimatePresence initial={false}>
          {filed ? (
            <motion.div
              key="file"
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="absolute -right-2 -bottom-4 flex items-center gap-2.5 rounded-xl border border-border bg-card py-2 ps-2.5 pe-3.5 shadow-lg sm:-right-4"
            >
              <span className="grid size-7 place-items-center rounded-md bg-muted">
                <FileText className="size-4" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">Vollmer_Kontrolle.docx</span>
                <span className="block text-[11px] text-muted-foreground">Word-Datei, mit Überschriften und Tabstopps</span>
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
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
