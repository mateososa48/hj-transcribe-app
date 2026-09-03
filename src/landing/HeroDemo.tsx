import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Mic } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { LiveRibbon } from './LiveRibbon';
import { createSpeechEnvelope } from './speech';
import { heroVoice, publishVoice, SILENCE } from './voice';

/**
 * The hero: the letter is the object.
 *
 * A tall A4 page on the right, set in the document face, dissolving below the
 * fold; the words and the app's own recording window on the left. One rAF
 * clock runs the scene: the recorder hears speech (its ribbon is the app's
 * real one, listening to the same voice the shader field hears), the spoken
 * words arrive as they are recognised, Fertig is pressed, and the section
 * writes itself into the letter where it belongs, filed by the app's job chip.
 *
 * The dosing line is the whole product in one beat: "eins null null" is what
 * was SAID, "1-0-0" is what lands in the letter.
 */

const SPOKEN_WORDS = 'Aktuelle Therapie: ASS hundert eins null null, Clopidogrel fünfundsiebzig eins null null bis Mai sechsundzwanzig.'.split(' ');

/** The section heading stands in the letter from the start, as the template
 *  put it there; the dictation fills the lines beneath it. */
const LETTER_LINES = [{ text: 'ASS 100   1-0-0' }, { text: 'Clopidogrel 75  1-0-0 bis 5/26' }];

/** Scene timeline, in ms on the shared clock. */
const T = {
  fadeIn: 400,
  speakStart: 500,
  speakEnd: 4600,
  press: 4900,
  jobStart: 5200,
  writeStart: 5800,
  writeEnd: 7600,
  jobDone: 7800,
  hold: 10200,
  total: 11000,
};

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
    // Ease out at the end of the loop and back in at the start, so the wrap
    // from the finished letter to the empty one is a breath, not a pop.
    fade: Math.max(
      t > T.hold ? Math.min(1, (t - T.hold) / (T.total - T.hold)) : 0,
      t < T.fadeIn ? 1 - t / T.fadeIn : 0,
    ),
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

export function HeroDemo({ lead }: { lead: ReactNode }) {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState<Scene>(() => sceneAt(0));
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      setScene(FINISHED);
      publishVoice(SILENCE);
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
      // The voice runs outside React: the ribbon and the field read it directly.
      publishVoice(envelope(now, s.speaking));
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
        publishVoice(SILENCE);
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
      publishVoice(SILENCE);
    };
  }, []);

  // Distribute written characters across the letter lines.
  let remaining = scene.charsWritten;
  const lines = LETTER_LINES.map((line) => {
    const shown = Math.max(0, Math.min(line.text.length, remaining));
    remaining -= shown;
    return { ...line, shown };
  });
  const demoOpacity = 1 - scene.fade * 0.9;

  const seconds = String(Math.min(59, Math.floor(Math.min(scene.t, T.speakEnd) / 1000))).padStart(2, '0');

  return (
    <div ref={hostRef} className="grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-6 lg:self-center lg:pb-12">{lead}</div>

      {/* The letter, with the app's recording window laid over its corner. */}
      <div className="relative lg:col-span-6">
        {/* The page, laid on the desk, dissolving below the fold. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 48, rotateX: 9 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 170, damping: 26 }}
          style={{ transformPerspective: 1400, transformOrigin: '50% 0%' }}
          className="relative h-[38rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] sm:h-[36rem] sm:[mask-image:linear-gradient(to_bottom,black_64%,transparent_96%)] lg:h-[42rem]"
        >
          <div className="rounded-[6px] border border-border bg-white px-8 pt-32 pb-9 shadow-[0_1px_2px_rgba(12,12,13,0.05),0_40px_90px_-30px_rgba(66,48,255,0.22)] sm:px-12 sm:pt-12 sm:pb-12">
            <div className="font-document text-[0.95rem] leading-[1.75] text-foreground/75 sm:text-[1.02rem]">
              {/* The address block only where the page is tall enough to spare it:
                  on a phone the written section must arrive before the fade. */}
              <div className="hidden sm:block">
                <p>An</p>
                <p>Dres. med. Weber / Kaufmann</p>
                <p>Rheinallee 12, 55118 Mainz</p>
              </div>
              <p className="sm:mt-[1.4em]">Mainz, 31.08.2026</p>
              <p className="mt-[1.4em]">Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege,</p>
              <p className="hidden sm:block">ich darf nachfolgend über die letzten Untersuchungen, Herrn Vollmer betreffend, zusammenfassend berichten.</p>
              <p className="mt-[1.4em] font-bold underline underline-offset-4">Diagnosen</p>
              <p>1. Koronare Herzkrankheit, Z. n. PCI/Stent RIVA 03/2026</p>
              <p>2. Arterielle Hypertonie</p>

              {/* The section being written, in the letter's own ink. Its heading
                  waits in the letter, grey until the dictation arrives. */}
              <div className="mt-[1.4em] text-foreground">
                <p
                  className={cn(
                    'font-bold underline underline-offset-4 transition-colors duration-300',
                    scene.charsWritten === 0 ? 'text-foreground/60' : 'text-foreground',
                  )}
                >
                  Aktuelle Therapie
                </p>
                <div style={{ opacity: demoOpacity }}>
                  {lines.map((line, i) => (
                    <p key={line.text} className="min-h-[1.75em] whitespace-pre">
                      {line.text.slice(0, line.shown)}
                      {(line.shown > 0 && line.shown < line.text.length) || (i === 0 && scene.charsWritten === 0) ? (
                        <span
                          className={cn(
                            '-mb-0.5 inline-block h-[1.1em] w-[2px] translate-y-1 bg-foreground/70',
                            scene.charsWritten === 0 && !reduce && 'animate-pulse',
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </p>
                  ))}
                </div>
              </div>

              <p className="mt-[1.4em] font-bold underline underline-offset-4">Zusammenfassende Beurteilung</p>
              <p>Herr Vollmer stellte sich zur Verlaufskontrolle vor. Unter Belastung keine Angina pectoris; die Belastbarkeit ist gut.</p>
              <p>Im EKG bestand ein normaler Sinusrhythmus. Echokardiographisch zeigte sich eine gute globale und regionale linksventrikuläre Funktion.</p>
            </div>
          </div>
        </motion.div>

        {/* The app's recording window, over the corner of the page, and under
            it what the window hears: the words as they are recognised, then
            where they were filed. Decorative; the letter carries the meaning. */}
        <motion.div
          aria-hidden
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 220, damping: 26 }}
          className="absolute -top-4 right-4 flex flex-col items-end gap-2 select-none sm:-top-5 sm:-right-5"
        >
          <div className="glass-white flex items-center gap-2.5 rounded-2xl py-2 ps-2.5 pe-2">
            <LiveRibbon probe={heroVoice} className="h-9 w-24 shrink-0 sm:w-28" />
            <span className="text-[15px] font-semibold tracking-tight tabular-nums">0:{seconds}</span>
            <span
              className={cn(
                'btn-liquid-dark flex h-8 items-center gap-1 rounded-full ps-2.5 pe-3 text-[13px] font-medium text-white transition-transform duration-150',
                scene.pressed && !reduce && 'scale-[0.96]',
              )}
            >
              <Check className="size-3.5" aria-hidden />
              Fertig
            </span>
          </div>

          {/* The strip appears with the first word and grows as the words
              arrive, the way live captions do; nothing else moves. */}
          <div
            className={cn(
              'glass-white w-[16.5rem] max-w-[calc(100vw-3.5rem)] rounded-xl px-3 py-2 text-[0.8rem] leading-snug transition-[opacity,transform] duration-300',
              scene.spokenCount === 0 && scene.job === 'none' ? 'translate-y-1 opacity-0' : 'translate-y-0',
            )}
            style={{ opacity: scene.spokenCount === 0 && scene.job === 'none' ? 0 : demoOpacity }}
          >
            {scene.job === 'none' ? (
              <p className="text-foreground/75">
                <Mic className="me-1.5 inline size-3 -translate-y-px" aria-hidden />
                {SPOKEN_WORDS.slice(0, scene.spokenCount).map((w, i) => (
                  <motion.span
                    key={i}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {w}{' '}
                  </motion.span>
                ))}
              </p>
            ) : (
              <motion.p
                key={scene.job}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                {scene.job === 'done' ? (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="size-3" aria-hidden />
                  </span>
                ) : (
                  <Spinner className="size-3.5 shrink-0" />
                )}
                <span className={cn('whitespace-nowrap', scene.job === 'done' && 'font-medium')}>
                  {scene.job === 'done' ? 'In „Aktuelle Therapie" eingefügt' : 'Wird eingefügt …'}
                </span>
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
