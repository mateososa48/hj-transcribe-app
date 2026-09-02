import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Mic } from 'lucide-react';

import { cn } from '@/lib/utils';
import { LiveRibbon } from './LiveRibbon';
import { ShaderField } from './ShaderField';
import { createSpeechEnvelope, type SpeechFrame } from './speech';

/**
 * Accuracy, shown rather than claimed: a lexicon with a stage.
 *
 * One headword at a time, set large in the display face and in one of the
 * ribbon's hues, arrives on a spring. Above it the same thing the way it was
 * said, streaming in as sounds while the app's real ribbon breathes beneath.
 * Beside the stage, the lexicon: every term the scene will show, the current
 * one lit, any of them a click away. The last entry is the promise that
 * matters most: where the dosage was never said, the letter shows a gap in
 * amber, never a guess.
 *
 * No percentages anywhere. A number that cannot be sourced is not a fact.
 */

type Kind = 'term' | 'value' | 'dose' | 'gap';

const HUE: Record<Kind, { text: string; bg: string; label: string }> = {
  term: { text: 'text-[#8a22b6]', bg: 'bg-[#a52bd8]', label: 'Fachbegriff' },
  value: { text: 'text-[#3a2bd9]', bg: 'bg-[#4230ff]', label: 'Messwert' },
  dose: { text: 'text-[#c4245e]', bg: 'bg-[#d92a68]', label: 'Dosierung' },
  gap: { text: 'text-[#9a5f0a]', bg: 'bg-[#b4700f]', label: 'Nicht genannt' },
};

const ENTRIES: Array<{ said: string; written: string; kind: Kind; note: string }> = [
  { said: 'P C I Stent R I V A', written: 'PCI/Stent RIVA', kind: 'term', note: 'Eingriff und Gefäß, abgekürzt wie im Katheterbericht.' },
  { said: 'L V E F achtundfünfzig Prozent', written: 'LVEF 58 %', kind: 'value', note: 'Ein Messwert, mit Prozentzeichen und dem Leerzeichen davor.' },
  { said: 'Trikuspidalklappeninsuffizienz Grad eins', written: 'Trikuspidalklappeninsuffizienz Grad 1', kind: 'term', note: 'Ein Wort. Es bleibt eines.' },
  { said: 'N T pro B N P', written: 'NT-proBNP', kind: 'term', note: 'Sechs Laute werden ein Laborwert.' },
  { said: 'einhundertfünfundvierzig zu neunzig', written: '145/90 mmHg', kind: 'value', note: 'Ein Blutdruck, mit seiner Einheit.' },
  { said: 'Bisoprolol zwei komma fünf, eins null null', written: 'Bisoprolol 2,5   1-0-0', kind: 'dose', note: 'Wirkstoff, Stärke, Einnahmeschema, auf Tabulatoren.' },
  { said: 'Apixaban weiter wie bisher', written: 'Apixaban [FEHLT: Dosierung]', kind: 'gap', note: 'Keine Dosis genannt, also keine Dosis erfunden. Die Lücke steht im Brief, bis Sie sie füllen.' },
];

const SAY_MS = 1100;
const LAND_MS = 1250;
const STEP_MS = 3000;
const SILENCE: SpeechFrame = { low: 0, mid: 0, high: 0, level: 0 };

export function Genauigkeit() {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<SpeechFrame>(SILENCE);
  const probe = useCallback(() => frameRef.current, []);
  const level = useCallback(() => frameRef.current.level, []);
  const [index, setIndex] = useState(2);
  const [local, setLocal] = useState(0);
  const [held, setHeld] = useState(false);

  // The clock: runs while on screen, advances the lexicon, publishes the voice.
  useEffect(() => {
    if (reduce) {
      setLocal(LAND_MS + 1);
      return;
    }
    let raf = 0;
    let started = performance.now();
    let lastStep = -1;
    let active = false;
    const envelope = createSpeechEnvelope();
    const tick = () => {
      const now = performance.now();
      const elapsed = now - started;
      const t = held ? Math.min(elapsed, LAND_MS + 1) : elapsed % STEP_MS;
      if (!held && elapsed >= STEP_MS) {
        started = now - (elapsed % STEP_MS);
        // Reset the clock in the same render as the index, so the new entry
        // never reads as already landed for a frame.
        setLocal(0);
        setIndex((i) => (i + 1) % ENTRIES.length);
      }
      frameRef.current = envelope(now, t < SAY_MS);
      const step = Math.floor(t / 50);
      if (step !== lastStep) {
        lastStep = step;
        setLocal(t);
      }
      raf = requestAnimationFrame(tick);
    };
    const sync = (on: boolean) => {
      if (on && !active) {
        active = true;
        started = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!on && active) {
        active = false;
        cancelAnimationFrame(raf);
        frameRef.current = SILENCE;
      }
    };
    const observer = new IntersectionObserver(([e]) => sync((e?.isIntersecting ?? false) && document.visibilityState === 'visible'), {
      threshold: 0.3,
    });
    const onVisibility = () => sync(active && document.visibilityState === 'visible');
    if (hostRef.current) observer.observe(hostRef.current);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(raf);
      frameRef.current = SILENCE;
    };
    // The clock restarts when the reader takes over (held) so the chosen
    // entry plays from its first sound.
  }, [reduce, held, index]);

  const choose = (i: number) => {
    setHeld(true);
    setIndex(i);
    setLocal(0);
  };

  const entry = ENTRIES[index]!;
  const words = entry.said.split(' ');
  const shown = reduce ? words.length : Math.round(Math.min(1, local / SAY_MS) * words.length);
  const landed = reduce || local >= LAND_MS;

  // The word on stage: the last one that landed. While the next is still
  // being said, the previous word stays, dimmed, so the stage is never empty.
  const [staged, setStaged] = useState(index);
  useEffect(() => {
    if (landed) setStaged(index);
  }, [landed, index]);
  const shownEntry = ENTRIES[staged]!;
  const hue = HUE[shownEntry.kind];
  const gapParts = shownEntry.kind === 'gap' ? shownEntry.written.split(' [') : null;

  return (
    <section ref={hostRef} id="genauigkeit" className="py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 className="font-display max-w-[14ch] text-[2.2rem] leading-[1.04] font-medium text-balance sm:text-[2.8rem]">
          Spricht Kardiologie.
        </h2>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-pretty text-muted-foreground">
          Fachbegriffe, Abkürzungen, Wirkstoffe, Dosierungen: Der Assistent kennt die Sprache der Praxis und schreibt
          sie so, wie sie im Brief stehen muss.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-12 lg:gap-8">
          {/* The lexicon: one line, one marker that slides to the current word. */}
          <ol
            className="order-2 grid grid-cols-2 gap-x-6 gap-y-0.5 lg:order-1 lg:col-span-3 lg:block lg:space-y-0 lg:border-l lg:border-border"
            aria-label="Beispiele"
          >
            {ENTRIES.map((e, i) => {
              const on = i === index;
              return (
                <li key={e.written} className="relative">
                  {on ? (
                    <motion.span
                      layoutId="lexicon-marker"
                      aria-hidden
                      className="absolute top-1.5 bottom-1.5 -left-px hidden w-px bg-foreground lg:block"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    aria-current={on ? 'true' : undefined}
                    className={cn(
                      'block w-full truncate rounded-md py-1.5 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:px-4',
                      on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {e.written.replace(' [FEHLT: Dosierung]', ' …')}
                  </button>
                </li>
              );
            })}
          </ol>

          {/* The stage. */}
          <div
            role="img"
            aria-label={`Gesagt: ${shownEntry.said}. Im Brief: ${shownEntry.written}.`}
            className="relative order-1 min-w-0 overflow-hidden rounded-3xl border border-border bg-background px-7 py-7 sm:px-12 sm:py-9 lg:order-2 lg:col-span-9"
          >
            {/* The same field as the hero and the closing, at lower strength,
                breathing with the voice on stage. */}
            <ShaderField voice={level} strength={0.55} className="absolute inset-0" />

            <div className="relative">
              {/* Said. */}
              <p className="flex min-h-[3.2em] items-start gap-2 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-base">
                <Mic className="mt-1 size-4 shrink-0" aria-hidden />
                <span>
                  {words.map((w, j) => (
                    <span key={j} className={cn('transition-opacity duration-150', j < shown ? 'opacity-100' : 'opacity-0')}>
                      {w}{' '}
                    </span>
                  ))}
                </span>
              </p>

              {/* Written: the headword. */}
              {/* The size lives on the wrapper so its reserved two lines are measured
                  in the headword's own em: a wrapping compound noun must never
                  change the stage's height and shift the page beneath. */}
              <div
                className={cn(
                  'mt-5 min-h-[2.1em] text-[2.2rem] leading-[1.02] transition-opacity duration-500 sm:mt-6 sm:text-[3.2rem] lg:text-[4rem]',
                  landed ? 'opacity-100' : 'opacity-35',
                )}
                lang="de"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={shownEntry.written}
                    initial={reduce ? false : { opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className={cn('font-display font-medium tracking-[-0.02em] break-words hyphens-auto', hue.text)}
                  >
                    {gapParts ? (
                      <>
                        <span className="text-foreground">{gapParts[0]}</span>{' '}
                        <span className="font-sans text-[0.55em] font-medium tracking-normal">[{gapParts[1]}</span>
                      </>
                    ) : (
                      shownEntry.written
                    )}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* The voice, heard. */}
              {/* The ribbon paints an opaque white ground; multiply lets it
                  lie on the tinted stage without a box. */}
              <LiveRibbon probe={probe} className="-mx-2 -mb-3 h-20 w-[calc(100%+1rem)] max-w-none mix-blend-multiply sm:-mb-4 sm:h-24" />

              {/* Kind and note. */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className={cn('font-semibold', hue.text)}>{hue.label}</span>
                <span
                  className={cn('max-w-[52ch] text-muted-foreground transition-opacity duration-500', landed ? 'opacity-100' : 'opacity-35')}
                >
                  {shownEntry.note}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Three principles. */}
        <dl className="mt-12 grid gap-8 border-t border-border pt-8 sm:grid-cols-3 sm:gap-10">
          {[
            { t: 'Begriffe bleiben Begriffe.', d: 'Zusammengesetzte Wörter bleiben ganz, Abkürzungen werden Abkürzungen, Gefäße behalten ihre Namen.' },
            { t: 'Zahlen werden Werte.', d: 'Gesprochene Drücke, Frequenzen und Dosierungen stehen als 145/90, als 72/min und als 2,5 im Brief.' },
            { t: 'Lücke statt Erfindung.', d: 'Was nicht gesagt wurde, steht nicht im Brief. Fehlt etwas, steht dort eine Markierung, nie eine Vermutung.' },
          ].map((x) => (
            <div key={x.t} className="max-w-[40ch]">
              <dt className="font-semibold">{x.t}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">{x.d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
