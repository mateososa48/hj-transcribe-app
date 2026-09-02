import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { FileText, Mic, Stethoscope } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The three tools as chapters in one dark slab: text pinned left, the real
 * application switching on the right as the reader scrolls. One continuous
 * surface instead of three lookalike sections. The reader keeps one frame of
 * reference and the product changes inside it.
 *
 * A hairline rail beside the chapters fills with scroll progress, so the
 * pinned stretch has a visible length; clicking a chapter scrolls to it.
 *
 * The screenshots are genuine captures of the running app, seeded with
 * synthetic patients. Under reduced motion the slab unrolls into stacked
 * chapters with nothing pinned.
 */

const CHAPTERS = [
  {
    id: 'diktat',
    icon: Mic,
    tool: 'Diktat',
    title: 'Frei sprechen. Fertig formuliert.',
    body: 'Sie sprechen über den Fall wie zu einer Kollegin. Daraus entsteht die Zusammenfassende Beurteilung: vollständige Sätze, Ihre Reihenfolge, Ihre Formulierungen. Ergänzungen werden nachdiktiert und eingearbeitet, nicht neu geschrieben.',
    img: '/landing/diktat.webp',
    alt: 'Ein Diktat, als fertige Zusammenfassende Beurteilung formuliert',
  },
  {
    id: 'termin',
    icon: Stethoscope,
    tool: 'Sprechstunde',
    title: 'Das Gespräch schreibt mit.',
    body: 'Während Sie beim Patienten sind, läuft die Aufnahme mit. Danach: das Transkript nach Sprechern getrennt, die Aufnahme zum Nachhören, fertige Notizen in Abschnitten. Ein Klick auf ein Wort springt an die Stelle in der Aufnahme.',
    img: '/landing/transkript.webp',
    alt: 'Ein Sprechstunden-Transkript, nach Arzt und Patient getrennt',
  },
  {
    id: 'bericht',
    icon: FileText,
    tool: 'Bericht',
    title: 'Der Brief als Seite.',
    body: 'Ein Arztbrief wie in Word: eine A4-Seite mit Ihren Abschnitten. Jeder Abschnitt lässt sich einzeln diktieren. Sie nennen ihn beim Namen, der Text landet an der richtigen Stelle. Am Ende eine Word-Datei mit echten Überschriften und echten Tabstopps.',
    img: '/landing/bericht.webp',
    alt: 'Der Berichtseditor: eine A4-Seite mit diktierbaren Abschnitten',
  },
] as const;

export function Scrollytelling() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);
  const chapterAt = (p: number) => Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(p * CHAPTERS.length)));
  useMotionValueEvent(scrollYProgress, 'change', (p) => setActive(chapterAt(p)));
  // The page may open already inside the slab (a reload, an anchor); the
  // change event alone would leave chapter one lit until the first scroll.
  // Measured from the DOM, because the motion value may not have settled yet.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, el.offsetHeight - window.innerHeight);
    setActive(chapterAt((window.scrollY - top) / travel));
  }, []);

  const jumpTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / CHAPTERS.length) * travel, behavior: 'smooth' });
  };

  /* Stacked fallback: every chapter standing, nothing pinned. */
  if (reduce) {
    return (
      <section id="werkzeuge" className="scroll-mt-24 px-3 sm:px-4">
        <div className="rounded-3xl bg-[#101012] py-20 text-white sm:py-24">
          <div className="mx-auto w-full max-w-6xl space-y-20 px-6 sm:px-10">
            {CHAPTERS.map((c) => (
              <div key={c.id} className="grid items-center gap-8 lg:grid-cols-12">
                <ChapterText chapter={c} active className="lg:col-span-4" />
                <figure className="app-shot-dark lg:col-span-8">
                  <img src={c.img} width={3200} height={1612} alt={c.alt} loading="lazy" />
                </figure>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const chapter = CHAPTERS[active]!;

  return (
    <section id="werkzeuge" className="scroll-mt-24 px-3 sm:px-4">
      <div ref={ref} className="relative h-[320vh]">
        <div className="sticky top-0 flex min-h-dvh items-center py-4">
          <div className="w-full rounded-3xl bg-[#101012] py-10 text-white shadow-[0_40px_120px_-40px_rgba(12,12,13,0.5)] sm:py-24">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-12 sm:px-10">
              {/* The chapters, all listed beside a rail that fills as you scroll. */}
              <div className="relative lg:col-span-4">
                <div aria-hidden className="absolute top-1 bottom-1 left-0 w-px bg-white/12">
                  <motion.div className="h-full w-full origin-top bg-white" style={{ scaleY: scrollYProgress }} />
                </div>
                <div className="space-y-8 ps-6">
                  {CHAPTERS.map((c, i) => (
                    <ChapterText key={c.id} chapter={c} active={i === active} onSelect={() => jumpTo(i)} />
                  ))}
                </div>
              </div>

              {/* One frame, three states. */}
              <div className="relative lg:col-span-8">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.figure
                    key={chapter.id}
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.985 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 32 }}
                    className="app-shot-dark"
                  >
                    <img src={chapter.img} width={3200} height={1612} alt={chapter.alt} />
                  </motion.figure>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChapterText({
  chapter,
  active,
  onSelect,
  className,
}: {
  chapter: (typeof CHAPTERS)[number];
  active: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const Icon = chapter.icon;
  const content = (
    <>
      <p className="flex items-center gap-2 text-sm font-medium text-white/55">
        <Icon className="size-4" aria-hidden />
        {chapter.tool}
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{chapter.title}</h3>
      <p
        className={cn(
          'mt-2.5 max-w-[44ch] text-[0.95rem] leading-relaxed text-white/65 transition-[max-height,opacity] duration-300',
          active ? 'max-h-48 opacity-100' : 'max-h-0 overflow-hidden opacity-0',
        )}
      >
        {chapter.body}
      </p>
    </>
  );
  const classes = cn('block w-full text-start transition-opacity duration-300', active ? 'opacity-100' : 'opacity-40 hover:opacity-70', className);
  return onSelect ? (
    <button type="button" onClick={onSelect} aria-current={active ? 'true' : undefined} className={cn(classes, 'cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60')}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
