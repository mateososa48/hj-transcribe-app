import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
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

const TEMPLATES: Template[] = [
  { name: 'Kardiologischer Arztbrief', sections: ['Diagnosen', 'Anamnese', 'Zusammenfassende Beurteilung', 'Aktuelle Therapie'] },
  { name: 'Kurzbefund Echo', sections: ['Fragestellung', 'Befund', 'Beurteilung'] },
  { name: 'Reha-Bericht', sections: ['Diagnosen', 'Verlauf', 'Empfehlung', 'Medikation'] },
  { name: 'Gutachten', sections: ['Fragestellung', 'Anamnese', 'Befunde', 'Beurteilung'] },
  { name: 'Überweisung', sections: ['Diagnosen', 'Fragestellung', 'Bisherige Therapie'] },
  { name: 'Herzkatheter-Bericht', sections: ['Indikation', 'Befund', 'Intervention', 'Empfehlung'] },
  { name: 'Belastungs-EKG', sections: ['Fragestellung', 'Belastung', 'Befund', 'Beurteilung'] },
  { name: 'Langzeit-EKG', sections: ['Aufzeichnung', 'Rhythmus', 'Beurteilung'] },
  { name: 'Entlassbrief', sections: ['Diagnosen', 'Verlauf', 'Medikation bei Entlassung', 'Empfehlung'] },
];

/** Your own sheet types these, one after another, then starts over. */
const OWN_SECTIONS = ['Fragestellung', 'Befund', 'Beurteilung', 'Empfehlung'];
const OWN_STEP_MS = 1500;
const OWN_HOLD_MS = 3200;
const OWN_TOTAL_MS = OWN_SECTIONS.length * OWN_STEP_MS + OWN_HOLD_MS;

export function Vorlagen({ heading }: { heading: ReactNode }) {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLElement | null>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduce) {
      setT(OWN_SECTIONS.length * OWN_STEP_MS);
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

  const sheets = reduce ? TEMPLATES : [...TEMPLATES, ...TEMPLATES];

  return (
    <section ref={hostRef} id="vorlagen" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      {/* The hero's field, quiet, under the shelf. */}
      <ShaderField strength={0.42} className="absolute inset-0" />

      <div className="relative mx-auto w-full max-w-6xl px-6">{heading}</div>

      {/* The shelf. */}
      <div
        className={cn(
          'relative mt-12 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]',
          reduce && 'overflow-x-auto [scrollbar-width:none]',
        )}
      >
        <div className={cn('flex w-max items-start gap-5 py-4 ps-6', !reduce && 'vorlagen-shelf')}>
          {sheets.map((tpl, i) => (
            <Sheet key={`${tpl.name}-${i}`} template={tpl} raised={i % 2 === 1} />
          ))}
          <OwnSheet t={t} raised={sheets.length % 2 === 1} />
          {!reduce ? <OwnSheet t={t} raised={(sheets.length + 1) % 2 === 1} ghost /> : null}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- sheets -- */

function Sheet({ template, raised }: { template: Template; raised: boolean }) {
  return (
    <article
      className={cn(
        'paper-mini w-[16rem] shrink-0 px-6 py-6 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:shadow-[0_2px_4px_rgba(12,12,13,0.06),0_28px_56px_-24px_rgba(66,48,255,0.28)] sm:w-[18rem]',
        raised && 'mt-6',
      )}
      aria-label={`Vorlage ${template.name}`}
    >
      <p className="font-document text-[0.95rem] leading-snug font-bold underline underline-offset-4">{template.name}</p>
      <div className="mt-4 space-y-3">
        {template.sections.map((s) => (
          <div key={s}>
            <p className="font-document text-[0.78rem] leading-snug font-bold">{s}</p>
            <div className="mt-1 space-y-1" aria-hidden>
              <span className="block h-1 w-full rounded-full bg-foreground/8" />
              <span className="block h-1 w-[72%] rounded-full bg-foreground/8" />
            </div>
          </div>
        ))}
      </div>
      <p className="font-document mt-5 text-[0.72rem] text-foreground/50">Mit freundlichen kollegialen Grüßen</p>
    </article>
  );
}

function OwnSheet({ t, raised, ghost = false }: { t: number; raised: boolean; ghost?: boolean }) {
  const typedCount = Math.min(OWN_SECTIONS.length, Math.floor(t / OWN_STEP_MS));
  const inProgress = t < OWN_SECTIONS.length * OWN_STEP_MS ? OWN_SECTIONS[typedCount] : null;
  const partial = inProgress ? inProgress.slice(0, Math.round(((t % OWN_STEP_MS) / (OWN_STEP_MS * 0.7)) * inProgress.length)) : '';

  return (
    <article
      aria-hidden={ghost ? true : undefined}
      aria-label={ghost ? undefined : 'Ihre eigene Vorlage'}
      className={cn(
        'w-[16rem] shrink-0 rounded-[6px] border border-dashed border-foreground/30 bg-background/70 px-6 py-6 backdrop-blur-sm transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 sm:w-[18rem]',
        raised && 'mt-6',
      )}
    >
      <p className="flex items-center gap-1.5 font-document text-[0.95rem] leading-snug font-bold underline underline-offset-4">
        <Plus className="size-3.5 shrink-0" aria-hidden />
        Eigene Vorlage
      </p>
      <div className="mt-4 min-h-[9.5rem] space-y-3">
        {OWN_SECTIONS.slice(0, typedCount).map((s) => (
          <div key={s}>
            <p className="font-document text-[0.78rem] leading-snug font-bold">{s}</p>
            <div className="mt-1 space-y-1" aria-hidden>
              <span className="block h-1 w-full rounded-full bg-foreground/8" />
              <span className="block h-1 w-[72%] rounded-full bg-foreground/8" />
            </div>
          </div>
        ))}
        {inProgress ? (
          <p className="font-document text-[0.78rem] leading-snug font-bold">
            {partial}
            <span className="-mb-px inline-block h-[1em] w-px bg-foreground/70" aria-hidden />
          </p>
        ) : null}
      </div>
      <p className="font-document mt-5 text-[0.72rem] text-foreground/50">Ihre Abschnitte, Ihre Reihenfolge.</p>
    </article>
  );
}
