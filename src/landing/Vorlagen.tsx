import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Report templates as a list beside one letter. Choosing a template does not
 * swap a picture: the letter's sections slide into their new order, the ones
 * a template shares with the last one stay put, the new ones arrive. Which is
 * what the feature does to a Bericht.
 *
 * The list advances on its own while it is on screen until the reader touches
 * it; under reduced motion it stands still on the first template and sections
 * swap without travelling.
 */

const TEMPLATES: Array<{ name: string; sections: string[] }> = [
  { name: 'Kardiologischer Arztbrief', sections: ['Diagnosen', 'Anamnese', 'Zusammenfassende Beurteilung', 'Aktuelle Therapie'] },
  { name: 'Kurzbefund Echo', sections: ['Fragestellung', 'Befund', 'Beurteilung'] },
  { name: 'Reha-Bericht', sections: ['Diagnosen', 'Verlauf', 'Empfehlung', 'Medikation'] },
  { name: 'Gutachten', sections: ['Fragestellung', 'Anamnese', 'Befunde', 'Beurteilung'] },
  { name: 'Überweisung', sections: ['Diagnosen', 'Fragestellung', 'Bisherige Therapie'] },
];

const DWELL_MS = 4200;

export function Vorlagen({ contact, heading }: { contact: string; heading: ReactNode }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const hostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (reduce || touched) return;
    const host = hostRef.current;
    if (!host) return;
    let timer = 0;
    let onscreen = false;
    const run = () => {
      window.clearInterval(timer);
      if (onscreen && document.visibilityState === 'visible') {
        timer = window.setInterval(() => setActive((i) => (i + 1) % TEMPLATES.length), DWELL_MS);
      }
    };
    const observer = new IntersectionObserver(
      ([e]) => {
        onscreen = e?.isIntersecting ?? false;
        run();
      },
      { threshold: 0.5 },
    );
    observer.observe(host);
    document.addEventListener('visibilitychange', run);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', run);
      window.clearInterval(timer);
    };
  }, [reduce, touched]);

  const choose = (i: number) => {
    setTouched(true);
    setActive(i);
  };

  // On phones the list is a horizontal row; keep the lit template in view as
  // it advances, without ever moving the page vertically.
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const left = item.offsetLeft - list.offsetLeft;
    const right = left + item.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 8), behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [active, reduce]);

  const template = TEMPLATES[active]!;

  return (
    <section ref={hostRef} id="vorlagen" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        {heading}
        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* The list. */}
          <div className="min-w-0 lg:col-span-5">
            <div ref={listRef} aria-label="Berichtsvorlagen" className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-2 [scrollbar-width:none] lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
              {TEMPLATES.map((t, i) => {
                const on = i === active;
                return (
                  <button
                    key={t.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => choose(i)}
                    className={cn(
                      'group flex shrink-0 snap-start items-center gap-3 rounded-full border px-4 py-2.5 text-start text-sm font-medium transition-colors lg:w-full lg:rounded-2xl lg:border-transparent lg:px-4 lg:py-3.5 lg:text-base',
                      on
                        ? 'border-foreground bg-foreground text-background lg:bg-muted lg:text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground lg:hover:bg-muted/60',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn('hidden h-5 w-0.5 rounded-full transition-colors lg:block', on ? 'bg-foreground' : 'bg-transparent group-hover:bg-border')}
                    />
                    <span className="flex-1">{t.name}</span>
                    <span className={cn('hidden text-xs tabular-nums lg:block', on ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
                      {t.sections.length} Abschnitte
                    </span>
                  </button>
                );
              })}
              <a
                href={contact}
                className="flex shrink-0 snap-start items-center gap-3 rounded-full border border-dashed border-foreground/30 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full lg:rounded-2xl lg:px-4 lg:py-3.5 lg:text-base"
              >
                <span aria-hidden className="hidden w-0.5 lg:block" />
                <Plus className="size-4" aria-hidden />
                <span className="flex-1">Eigene Vorlage</span>
              </a>
            </div>
          </div>

          {/* The letter, re-ordering itself. */}
          <div className="lg:col-span-7">
            <div className="paper-mini mx-auto max-w-xl px-8 py-7 sm:px-10 sm:py-9">
              <div className="font-document text-[0.98rem] leading-[1.8]">
                <p className="text-foreground/55">Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege,</p>
                <p className="mb-[0.7em] text-foreground/55">wir berichten über die oben genannte Patientin.</p>
                <AnimatePresence initial={false} mode="popLayout">
                  {template.sections.map((s) => (
                    <motion.div
                      key={s}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                      className="mb-[0.55em]"
                    >
                      <p className="font-bold underline underline-offset-4">{s}</p>
                      <div className="mt-1.5 space-y-1.5" aria-hidden>
                        <span className="block h-1.5 w-full rounded-full bg-foreground/8" />
                        <span className="block h-1.5 w-[82%] rounded-full bg-foreground/8" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <p className="mt-[0.9em] text-foreground/55">Mit freundlichen kollegialen Grüßen</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
