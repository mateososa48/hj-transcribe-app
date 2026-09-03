import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  transform,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  type MotionValue,
} from 'motion/react';
import { FileText, Mic, Stethoscope } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCopy } from './i18n';

/**
 * The three tools as one pinned scene with a camera.
 *
 * Each chapter opens on the whole tool, then, as the reader keeps scrolling,
 * the frame moves in on the exact detail the text is about and callouts land
 * on real elements of the interface: the summary card and the Ergänzen key,
 * the speaker labels and a timestamp, the Diktieren key and a filed
 * dictation. Nothing is drawn over the product that is not in the product.
 *
 * The screenshots are genuine captures of the running app (3200px wide, so a
 * 1.6× move stays sharp), seeded with synthetic patients. Callouts are
 * counter-scaled so they keep their size while the picture grows under them.
 * Under reduced motion every chapter stands still at its zoomed framing.
 */

interface Anchor {
  /** Anchor, as fractions of the screenshot. */
  x: number;
  y: number;
  side: 'left' | 'right';
  /** Lift the label off the anchor (px, negative is up); a stem connects them. */
  dy?: number;
}

interface Callout extends Anchor {
  text: string;
}

type SceneId = 'diktat' | 'termin' | 'bericht';

/** What does not change with the language: the camera and the anchors. The
 *  picture itself comes with the words, one capture per language. */
interface Scene {
  id: SceneId;
  icon: typeof Mic;
  camera: { x: number; y: number; zoom: number };
  anchors: Anchor[];
}

interface Chapter extends Scene {
  tool: string;
  title: string;
  body: string;
  alt: string;
  img: string;
  callouts: Callout[];
}

const SCENES: Scene[] = [
  {
    id: 'diktat',
    icon: Mic,
    camera: { x: 0.6, y: 0.4, zoom: 1.6 },
    anchors: [
      { x: 0.548, y: 0.283, side: 'right' },
      { x: 0.664, y: 0.183, side: 'left' },
    ],
  },
  {
    id: 'termin',
    icon: Stethoscope,
    // The frame's top edge lands at y - 0.3125; the meta line at 0.176 needs
    // room above it for its callout.
    camera: { x: 0.5, y: 0.455, zoom: 1.6 },
    anchors: [
      { x: 0.384, y: 0.176, side: 'right' },
      { x: 0.35, y: 0.694, side: 'right' },
    ],
  },
  {
    id: 'bericht',
    icon: FileText,
    camera: { x: 0.6, y: 0.345, zoom: 1.45 },
    anchors: [
      { x: 0.681, y: 0.136, side: 'left' },
      { x: 0.78, y: 0.263, side: 'left' },
    ],
  },
];

const COUNT = SCENES.length;
const ASPECT = 3200 / 1612;

export function Scrollytelling() {
  const reduce = useReducedMotion();
  const t = useCopy();
  // The scenes with this language's words on them.
  const chapters = useMemo<Chapter[]>(
    () =>
      SCENES.map((scene) => {
        const words = t.tools.chapters[scene.id];
        return {
          ...scene,
          ...words,
          callouts: scene.anchors.map((a, i) => ({ ...a, ...(words.calloutAt[i] ?? {}), text: words.callouts[i] ?? '' })),
        };
      }),
    [t],
  );
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);
  const chapterAt = (p: number) => Math.min(COUNT - 1, Math.max(0, Math.floor(p * COUNT)));
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
    // Land inside the chapter with the camera already moved in.
    window.scrollTo({ top: top + ((i + 0.85) / COUNT) * travel, behavior: 'smooth' });
  };

  /* Standing fallback: every chapter at its zoomed framing, nothing pinned. */
  if (reduce) {
    return (
      <section id="werkzeuge" className="scroll-mt-24 px-3 sm:px-4">
        <div className="slab-dark relative overflow-hidden rounded-3xl py-20 text-white sm:py-24">
          <div className="relative mx-auto w-full max-w-6xl px-6 sm:px-10">
            <h2 className="font-display mb-14 max-w-[30ch] text-[1.6rem] leading-[1.1] font-medium text-balance sm:text-[2rem]">
              {t.tools.title}
              <span className="text-white/50"> {t.tools.titleRest}</span>
            </h2>
          </div>
          <div className="relative mx-auto w-full max-w-6xl space-y-24 px-6 sm:px-10">
            {chapters.map((c, i) => (
              <div key={c.id} className="grid items-center gap-8 lg:grid-cols-12">
                <ChapterText chapter={c} active className="lg:col-span-4" />
                <div className="lg:col-span-8">
                  <StaticFrame chapter={c} index={i} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="werkzeuge" className="scroll-mt-24 px-3 sm:px-4">
      <div ref={ref} className="relative h-[380vh]">
        {/* On phones the scene pins under the nav pill, not behind it. */}
        <div className="sticky top-[4.25rem] flex min-h-[calc(100dvh-4.25rem)] items-start py-3 sm:top-0 sm:min-h-dvh sm:items-center sm:py-4">
          <div className="slab-dark relative w-full overflow-hidden rounded-3xl py-8 text-white sm:py-14 lg:py-16">
            <div className="relative mx-auto hidden w-full max-w-6xl px-6 sm:block sm:px-10">
              <h2 className="font-display mb-10 max-w-[30ch] text-[2rem] leading-[1.1] font-medium text-balance">
                {t.tools.title}
                <span className="text-white/50"> {t.tools.titleRest}</span>
              </h2>
            </div>
            <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-12 lg:gap-6 sm:px-10">
              {/* The chapters, beside a rail that fills as you scroll. */}
              <div className="relative lg:col-span-4">
                <div aria-hidden className="absolute top-1 bottom-1 left-0 w-px bg-white/12">
                  <motion.div className="h-full w-full origin-top bg-white" style={{ scaleY: scrollYProgress }} />
                </div>
                <div className="space-y-5 ps-6 sm:space-y-7 lg:space-y-9">
                  {chapters.map((c, i) => (
                    <ChapterText key={c.id} chapter={c} active={i === active} onSelect={() => jumpTo(i)} />
                  ))}
                </div>
              </div>

              {/* One frame; the camera does the rest. Bleeds off the slab at desktop. */}
              <div className="lg:col-span-8">
                <div
                  className="relative w-full overflow-hidden rounded-[14px] border border-white/12 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] lg:w-[112%]"
                  style={{ aspectRatio: ASPECT }}
                >
                  {chapters.map((c, i) => (
                    <ChapterLayer key={c.id} chapter={c} index={i} progress={scrollYProgress} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ the frame -- */

/**
 * One chapter's picture: opacity from the chapter's slot in the scroll,
 * camera from its position inside that slot. Opens on the whole tool for the
 * first third, moves in over the middle, holds at the end.
 */
function ChapterLayer({ chapter, index, progress }: { chapter: Chapter; index: number; progress: MotionValue<number> }) {
  const start = index / COUNT;
  const end = (index + 1) / COUNT;
  const { x: fx, y: fy, zoom } = chapter.camera;

  // Plain motion values, set from one scroll listener. Motion would otherwise
  // try to compile a chain of transforms into a native scroll animation, and
  // a camera with a hold, a move and a crossfade is not a single keyframe list.
  const scale = useMotionValue(1);
  const x = useMotionValue('0%');
  const y = useMotionValue('0%');
  const opacity = useMotionValue(index === 0 ? 1 : 0);
  const inverse = useMotionValue(1);
  const calloutOpacity = useMotionValue(0);
  const calloutY = useMotionValue(10);

  const apply = (p: number) => {
    const q = Math.min(1, Math.max(0, (p - start) / (end - start)));
    const s = transform(q, [0.3, 0.72], [1, zoom]);
    scale.set(s);
    inverse.set(1 / s);
    x.set(`${transform(q, [0.3, 0.72], [0, (0.5 - fx) * 100])}%`);
    y.set(`${transform(q, [0.3, 0.72], [0, (0.5 - fy) * 100])}%`);
    // One short dissolve just after each boundary, both layers crossing in
    // the same window, so the next tool never ghosts over the current one.
    const fadeIn = index === 0 ? 1 : transform(p, [start, start + 0.025], [0, 1]);
    const fadeOut = index === COUNT - 1 ? 1 : transform(p, [end, end + 0.025], [1, 0]);
    opacity.set(Math.min(fadeIn, fadeOut));
    // Callouts arrive once the camera has settled and leave just before the
    // chapter ends, so the dissolve into the next tool carries no labels.
    const c = index === COUNT - 1 ? transform(q, [0.58, 0.72], [0, 1]) : transform(q, [0.58, 0.72, 0.94, 1], [0, 1, 1, 0]);
    calloutOpacity.set(c);
    calloutY.set(10 - 10 * c);
  };
  useMotionValueEvent(progress, 'change', apply);
  useEffect(() => {
    apply(progress.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div style={{ opacity }} className="absolute inset-0" aria-hidden={index !== 0 ? true : undefined}>
      <motion.div
        style={{ scale, x, y, transformOrigin: `${fx * 100}% ${fy * 100}%` }}
        className="absolute inset-0 will-change-transform"
      >
        <img src={chapter.img} width={3200} height={1612} alt={chapter.alt} className="block h-full w-full" loading={index === 0 ? 'eager' : 'lazy'} />
        {chapter.callouts.map((c, i) => (
          <motion.div
            key={i}
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, scale: inverse, opacity: calloutOpacity, y: calloutY, transformOrigin: '0 0' }}
            className="absolute hidden sm:block"
          >
            <CalloutMark callout={c} />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/** The reduced-motion frame: the chapter already moved in, callouts standing. */
function StaticFrame({ chapter, index }: { chapter: Chapter; index: number }) {
  // Nine tenths into the chapter: camera settled, callouts standing, before
  // the point where they would leave for the next tool.
  const progress = useMotionValue((index + 0.9) / COUNT);
  return (
    <div
      className="relative w-full overflow-hidden rounded-[14px] border border-white/12 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)]"
      style={{ aspectRatio: ASPECT }}
    >
      <ChapterLayer chapter={chapter} index={index} progress={progress} />
    </div>
  );
}

function CalloutMark({ callout }: { callout: Callout }) {
  const dy = callout.dy ?? 0;
  return (
    <div className="relative">
      <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-white ring-4 ring-white/30" />
      {dy !== 0 ? (
        <span
          aria-hidden
          className="absolute left-0 w-px bg-white/70"
          style={dy < 0 ? { bottom: 6, height: -dy - 6 } : { top: 6, height: dy - 6 }}
        />
      ) : null}
      <span
        className={cn(
          'absolute -translate-y-1/2 rounded-full bg-white px-3 py-1.5 text-[13px] leading-none font-medium whitespace-nowrap text-black shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]',
          callout.side === 'right' ? (dy === 0 ? 'left-4' : '-left-1.5') : dy === 0 ? 'right-4' : '-right-1.5',
        )}
        style={{ top: dy }}
      >
        {callout.text}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- the text -- */

function ChapterText({
  chapter,
  active,
  onSelect,
  className,
}: {
  chapter: Chapter;
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
      <h3 className="mt-2 text-[1.6rem] leading-[1.1] font-semibold tracking-tight text-balance lg:text-[1.9rem]">{chapter.title}</h3>
      <p
        className={cn(
          'mt-3 max-w-[40ch] text-[0.95rem] leading-relaxed text-white/65 transition-[max-height,opacity] duration-300',
          active ? 'max-h-40 opacity-100' : 'max-h-0 overflow-hidden opacity-0',
        )}
      >
        {chapter.body}
      </p>
    </>
  );
  const classes = cn('block w-full text-start transition-opacity duration-300', active ? 'opacity-100' : 'opacity-35 hover:opacity-70', className);
  return onSelect ? (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(classes, 'cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60')}
    >
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
