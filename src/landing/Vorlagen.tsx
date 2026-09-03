import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCopy } from './i18n';
import { ShaderField } from './ShaderField';

/**
 * Report templates as a shelf of letters.
 *
 * A slow, full-width drift of paper minis, one per report type, each set in
 * the letter's face with its own sections, over the hero's field at low
 * strength. Hovering pauses the shelf so a sheet can lift. The last sheet is
 * your own: it types its sections as you watch. Nothing here is a form; the
 * variety and the ownership are the point.
 *
 * The page's one marquee. Under reduced motion the shelf stands still and
 * scrolls by hand.
 */

interface Template {
  name: string;
  sections: string[];
}

/** Your own sheet types four sections, one after another, then starts over. */
const OWN_COUNT = 4;
const OWN_STEP_MS = 1500;
const OWN_HOLD_MS = 3200;
const OWN_TOTAL_MS = OWN_COUNT * OWN_STEP_MS + OWN_HOLD_MS;

export function Vorlagen({ heading }: { heading: ReactNode }) {
  const reduce = useReducedMotion();
  const copy = useCopy();
  const hostRef = useRef<HTMLElement | null>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduce) {
      setT(OWN_COUNT * OWN_STEP_MS);
      return;
    }
    let raf = 0;
    let running = false;
    let started = performance.now();
    let lastStep = -1;
    const tick = () => {
      const elapsed = (performance.now() - started) % OWN_TOTAL_MS;
      const step = Math.floor(elapsed / 60);
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
        }
      },
      { threshold: 0.25 },
    );
    if (hostRef.current) observer.observe(hostRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  const sheets = reduce ? copy.templates.list : [...copy.templates.list, ...copy.templates.list];

  return (
    <section ref={hostRef} id="vorlagen" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      {/* The hero's field, quiet, under the shelf. */}
      <ShaderField strength={0.42} className="absolute inset-0" />

      <div className="relative mx-auto w-full max-w-6xl px-6">{heading}</div>

      {/* The shelf. */}
      <div
        className={cn(
          'relative mt-6 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]',
          reduce && 'overflow-x-auto [scrollbar-width:none]',
        )}
      >
        <div className={cn('flex w-max items-start gap-5 py-10 ps-6', !reduce && 'vorlagen-shelf')}>
          {sheets.map((tpl, i) => (
            <Sheet key={i} template={tpl} raised={i % 2 === 1} />
          ))}
          <OwnSheet t={t} raised={sheets.length % 2 === 1} />
          {!reduce ? <OwnSheet t={t} raised={(sheets.length + 1) % 2 === 1} ghost /> : null}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- sheets -- */

/** Paragraph shapes: a few lines of varying length per section, so a page
 *  reads as written rather than as a list of labels. */
const SHAPES: number[][] = [
  [100, 62],
  [100, 84],
  [100, 100, 48],
  [100, 72],
  [100, 36],
];

function Paragraph({ shape }: { shape: number }) {
  const widths = SHAPES[shape % SHAPES.length]!;
  return (
    <div className="mt-[3px] space-y-[3px]" aria-hidden>
      {widths.map((w, i) => (
        <span key={i} className="block h-[3px] rounded-full bg-foreground/[0.13]" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

/** One A4 page with the anatomy of a real doctor's letter. */
function Page({
  subject,
  sections,
  own = false,
  raised,
  ariaLabel,
  ariaHidden,
}: {
  subject: ReactNode;
  sections: ReactNode;
  own?: boolean;
  raised: boolean;
  ariaLabel?: string;
  ariaHidden?: boolean;
}) {
  const t = useCopy();
  return (
    <article
      aria-hidden={ariaHidden ? true : undefined}
      aria-label={ariaLabel}
      className={cn(
        'paper-page w-[15rem] shrink-0 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:shadow-[0_2px_4px_rgba(12,12,13,0.06),0_28px_56px_-24px_rgba(66,48,255,0.28)] sm:w-[16.5rem]',
        own && 'paper-page-own',
        raised && 'mt-5',
      )}
      style={{ aspectRatio: '1 / 1.414' }}
    >
      <div className="font-document flex h-full flex-col px-5 pt-5 pb-4 text-[7.5px] leading-[1.5] text-foreground/85">
        {/* Letterhead and date. */}
        <div className="flex items-start justify-between gap-4 text-[7px] leading-[1.45] text-foreground/60">
          <div>
            <p className="font-bold text-foreground/80">{t.templates.letterhead[0]}</p>
            <p>{t.templates.letterhead[1]}</p>
          </div>
          <p className="shrink-0">{t.templates.date}</p>
        </div>
        {/* Address block. */}
        <div className="mt-4 text-[7px] leading-[1.45] text-foreground/70">
          {t.templates.recipient.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {/* Subject: the report type. */}
        <p className="mt-4 text-[8.5px] leading-snug font-bold">{subject}</p>
        <p className="mt-2">{t.templates.salutation}</p>
        <div className="mt-2 space-y-2">{sections}</div>
        {/* Closing and signature. */}
        <div className="mt-auto pt-3">
          <p>{t.templates.closing}</p>
          <span className="mt-2 block h-[4px] w-16 rounded-full bg-foreground/35" aria-hidden />
        </div>
      </div>
    </article>
  );
}

function Sheet({ template, raised }: { template: Template; raised: boolean }) {
  const t = useCopy();
  return (
    <Page
      raised={raised}
      ariaLabel={`${t.templates.template} ${template.name}`}
      subject={template.name}
      sections={template.sections.map((s, i) => (
        <div key={s}>
          <p className="font-bold underline underline-offset-[2px]">{s}</p>
          <Paragraph shape={i + template.name.length} />
        </div>
      ))}
    />
  );
}

function OwnSheet({ t, raised, ghost = false }: { t: number; raised: boolean; ghost?: boolean }) {
  const copy = useCopy();
  const OWN_SECTIONS = copy.templates.ownSections.slice(0, OWN_COUNT);
  const typedCount = Math.min(OWN_SECTIONS.length, Math.floor(t / OWN_STEP_MS));
  const inProgress = t < OWN_SECTIONS.length * OWN_STEP_MS ? OWN_SECTIONS[typedCount] : null;
  const partial = inProgress ? inProgress.slice(0, Math.round(Math.min(1, (t % OWN_STEP_MS) / (OWN_STEP_MS * 0.7)) * inProgress.length)) : '';

  return (
    <Page
      own
      raised={raised}
      ariaHidden={ghost}
      {...(ghost ? {} : { ariaLabel: copy.templates.ownAria })}
      subject={
        <span className="flex items-center gap-1">
          <Plus className="size-2.5 shrink-0" aria-hidden />
          {copy.templates.own}
        </span>
      }
      sections={
        <>
          {OWN_SECTIONS.slice(0, typedCount).map((s, i) => (
            <div key={s}>
              <p className="font-bold underline underline-offset-[2px]">{s}</p>
              <Paragraph shape={i + 2} />
            </div>
          ))}
          {inProgress ? (
            <p className="font-bold">
              {partial}
              <span className="-mb-px inline-block h-[1em] w-px bg-foreground/70" aria-hidden />
            </p>
          ) : null}
        </>
      }
    />
  );
}
