import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, FileText, Play } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { LiveRibbon } from './LiveRibbon';
import { createSpeechEnvelope, type SpeechFrame } from './speech';

/**
 * Four behaviours as a bento with one grammar: the object on top, staged on a
 * wash of one hue and clipped at the card's edge; the words beneath. The
 * cards are quiet, a hairline with a finer frame inside it, so the objects
 * carry the section. The objects are the app's own: the recording window
 * and the player in the glass material, the letter as paper, the job chip.
 *
 * Ergänzen: an addition is spoken, filed, and slid into the standing text.
 * Wort für Wort: the player runs and the highlight keeps pace. Unverlierbar:
 * the recording is written to disk every five seconds while it runs. Word:
 * dosing rows on real tab stops, and the file itself at the end.
 *
 * Every loop runs on its own clock, starts only when the card is on screen,
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

/* ----------------------------------------------------------------- card -- */

type Wash = 'violet' | 'rose' | 'blue' | 'peach';
const WASH: Record<Wash, string> = {
  violet: 'bg-[radial-gradient(80%_70%_at_20%_0%,rgba(165,43,216,0.10),transparent_70%),radial-gradient(60%_60%_at_100%_100%,rgba(66,48,255,0.07),transparent_70%)]',
  rose: 'bg-[radial-gradient(80%_70%_at_80%_0%,rgba(217,42,104,0.09),transparent_70%),radial-gradient(60%_60%_at_0%_100%,rgba(165,43,216,0.06),transparent_70%)]',
  blue: 'bg-[radial-gradient(80%_70%_at_30%_0%,rgba(66,48,255,0.09),transparent_70%),radial-gradient(60%_60%_at_100%_100%,rgba(217,42,104,0.05),transparent_70%)]',
  peach: 'bg-[radial-gradient(80%_70%_at_70%_0%,rgba(250,133,64,0.10),transparent_70%),radial-gradient(60%_60%_at_0%_100%,rgba(217,42,104,0.06),transparent_70%)]',
};

function Card({
  wide,
  wash,
  title,
  body,
  children,
  stageRef,
  stageClass,
}: {
  wide?: boolean;
  wash: Wash;
  title: string;
  body: string;
  children: ReactNode;
  stageRef?: React.RefObject<HTMLDivElement | null>;
  stageClass?: string;
}) {
  return (
    <div
      ref={stageRef}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(12,12,13,0.04),0_24px_60px_-36px_rgba(12,12,13,0.3)]',
        wide && 'lg:col-span-2',
      )}
    >
      {/* The finer frame inside the hairline. */}
      <div aria-hidden className="pointer-events-none absolute inset-[3px] z-10 rounded-[13px] border border-foreground/[0.045]" />
      {/* The stage: one hue's wash, the object, a fade into the words. */}
      <div className={cn('relative h-[17rem] overflow-hidden sm:h-[15.5rem]', WASH[wash], stageClass)}>
        {children}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-background" />
      </div>
      <div className="relative px-6 pt-1 pb-6">
        <h3 className="text-[1.05rem] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
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
    <Card
      wide
      wash="violet"
      stageRef={ref}
      title="Nachdiktieren, nicht neu diktieren."
      body="Fällt Ihnen nach dem Diktat noch etwas ein, sprechen Sie es nach. Es wird in den stehenden Text eingearbeitet, an der Stelle, an die es gehört."
    >
      {/* The standing letter, bleeding off the right and the foot. */}
      <div className="paper-mini absolute top-[7.4rem] left-6 w-[26rem] max-w-none px-6 py-5 sm:top-8 sm:left-[40%] sm:w-[30rem]">
        <div className="font-document text-[0.9rem] leading-[1.8]">
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
          <p>Bei erneuten Beschwerden bitten wir um Wiedervorstellung.</p>
        </div>
      </div>

      {/* The app's recording window, over the letter's edge. */}
      <div className="absolute top-6 left-6 flex w-fit max-w-[calc(100%-3rem)] flex-col rounded-2xl glass-panel px-3.5 py-2.5 sm:top-10">
        <div className="flex items-center gap-3">
          <LiveRibbon probe={probe} className="h-8 w-24 shrink-0 mix-blend-multiply" />
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
      <p className="absolute top-[7.6rem] left-6 hidden max-w-[17rem] text-[0.82rem] leading-relaxed text-muted-foreground sm:block">
        {ERG_SAID.map((w, i) => (
          <span key={i} className={cn('transition-opacity duration-150', i < said ? 'opacity-100' : 'opacity-0')}>
            {w}{' '}
          </span>
        ))}
      </p>

      {/* The job chip, filing the addition. */}
      <div
        className={cn(
          'absolute top-[13.6rem] left-6 flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 ps-2.5 pe-3 text-xs shadow-md transition-[opacity,transform] duration-300 sm:top-[11.2rem]',
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
    </Card>
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
    <Card
      wash="rose"
      stageRef={ref}
      title="Die Aufnahme liest mit."
      body="Beim Abhören läuft die Markierung im Transkript mit. Ein Klick auf ein Wort springt an genau diese Stelle im Ton."
    >
      {/* The mini player and, under it, the words it produced. */}
      <div className="absolute inset-x-6 top-9 rounded-2xl glass-panel p-4">
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
    </Card>
  );
}

/* ----------------------------------------------- narrow: unverlierbar ---- */

const SAVE_EVERY = 5;
const SAFE_TOTAL_MS = 16000;
const safeSpeaking = (t: number) => t > 400 && t < 14000;

function TileUnverlierbar() {
  const { t, finished, ref, probe } = useLoopClock(SAFE_TOTAL_MS, safeSpeaking);
  const seconds = finished ? 14 : Math.min(15, Math.floor(t / 1000));
  const saves = Math.floor(seconds / SAVE_EVERY);
  const justSaved = !finished && seconds % SAVE_EVERY === 0 && seconds > 0 && t % 1000 < 700;

  return (
    <Card
      wash="blue"
      stageRef={ref}
      title="Nichts geht verloren."
      body="Die Aufnahme wird alle fünf Sekunden auf Ihrem Rechner gesichert. Absturz, Tab geschlossen, Rechner im Ruhezustand: verloren sind höchstens Sekunden, nie ein Gespräch."
    >
      <div className="absolute inset-x-6 top-9">
        {/* The recording window, running. */}
        <div className="flex w-fit max-w-full flex-col rounded-2xl glass-panel px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <LiveRibbon probe={probe} className="h-8 w-24 shrink-0 mix-blend-multiply" />
            <span className="text-base font-semibold tracking-tight tabular-nums">0:{String(seconds).padStart(2, '0')}</span>
          </div>
          <p className="mt-0.5 self-end pe-0.5 text-[11px] text-muted-foreground">Sprechstunde</p>
        </div>
        {/* The saves, one every five seconds, as they happen. */}
        <ol className="mt-4 space-y-1.5" aria-label="Sicherungen">
          {[1, 2, 3].map((n) => {
            const at = n * SAVE_EVERY;
            const done = saves >= n;
            const flashing = justSaved && saves === n;
            return (
              <li
                key={n}
                className={cn(
                  'flex items-center gap-2.5 text-xs transition-opacity duration-300',
                  done ? 'opacity-100' : 'opacity-30',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full transition-colors duration-300',
                    done ? 'bg-foreground text-background' : 'bg-foreground/10 text-transparent',
                    flashing && 'bg-[#4230ff]',
                  )}
                  aria-hidden
                >
                  <Check className="size-2.5" />
                </span>
                <span className="tabular-nums">0:{String(at).padStart(2, '0')}</span>
                <span className="text-muted-foreground">{done ? 'auf dem Rechner gesichert' : 'wird gesichert'}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- wide: word ---- */

const W = { file: 2200, hold: 6400, total: 7200 };

function TileWord() {
  const reduce = useReducedMotion();
  const { t, finished, ref } = useLoopClock(W.total);
  const filed = finished || (t >= W.file && t < W.hold);

  return (
    <Card
      wide
      wash="peach"
      stageRef={ref}
      title="Landet in Word, wie er gehört."
      body="Echte Überschriften, echte Tabstopps. Die Dosierungsspalten sitzen auf Tabulatoren, nicht auf Leerzeichen, und überleben jede Bearbeitung in Word."
    >
      {/* The letter, bleeding off the foot. */}
      <div className="paper-mini absolute top-8 left-6 w-[26rem] max-w-[calc(100%-3rem)] px-6 py-5 sm:left-10">
        <div className="font-document text-[0.92rem] leading-[1.85]">
          <p className="font-bold underline underline-offset-2">Aktuelle Therapie</p>
          <TabRow name="ASS 100" dose="1-0-0" />
          <TabRow name="Sevikar 40/5" dose="1-0-0" />
          <TabRow name="Atorvastatin 40" dose="0-0-1" />
          <TabRow name="Bisoprolol 2,5" dose="1-0-0" />
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
            className="absolute top-[7.5rem] right-6 flex items-center gap-2.5 rounded-xl border border-border bg-card py-2 ps-2.5 pe-3.5 shadow-lg sm:right-10"
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
    </Card>
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
    <section className="py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        {heading}
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <TileErgaenzen />
          <TileFollowAlong />
          <TileUnverlierbar />
          <TileWord />
        </div>
      </div>
    </section>
  );
}
