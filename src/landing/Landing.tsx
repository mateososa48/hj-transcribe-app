import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import { Bento } from './Bento';
import { Genauigkeit } from './Genauigkeit';
import { HeroDemo } from './HeroDemo';
import { LangToggle } from './LangToggle';
import { Nav } from './Nav';
import { Scrollytelling } from './Scrollytelling';
import { ShaderField } from './ShaderField';
import { Vorlagen } from './Vorlagen';
import { useCopy } from './i18n';
import { heroLevel } from './voice';

/**
 * The landing page: the product's own language doing the selling.
 *
 * Design read: a product-led landing for German clinicians, calm and precise,
 * monochrome Geist with the app's own spectral ribbon as the single colour
 * device, the product shown real and running.
 *
 * The one signature picture is the hero: the recorder on the left, the letter
 * on the right, and a shader field under both, the ribbon's four hues laid on
 * white like ink under light and breathing in time with the demo's speech.
 * Everything after it is quieter.
 *
 * Shape system: buttons and chips are pills, panels and tiles are 24px,
 * paper is 6px. One dark slab on the page (the tools), everything else light.
 * Everything collapses to calm static layout under prefers-reduced-motion.
 */

const CONTACT = 'mailto:mateo_sosa@icloud.com?subject=Arzt-Assistent%20Zugang';

export function Landing() {
  const t = useCopy();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Nav contact={CONTACT} />
      <LangToggle />
      <main>
        <Hero />
        <Scrollytelling />
        <Genauigkeit />
        <Bento heading={<SectionHeading title={t.bento.title} />} />
        <Vorlagen
          heading={<SectionHeading title={t.templates.title} body={t.templates.body} />}
        />
        <Vertrauen />
      </main>
      <Closing />
    </div>
  );
}

/* ----------------------------------------------------------------- hero -- */

function Hero() {
  const reduce = useReducedMotion();
  const t = useCopy();

  // Keyed by position, so a language switch changes the words in place
  // instead of replaying their entrance.
  const word = (w: string, i: number) => (
    <motion.span
      key={i}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.06, type: 'spring', stiffness: 320, damping: 30 }}
      className="inline-block"
    >
      {w}&nbsp;
    </motion.span>
  );
  const [first = [], second = []] = t.hero.lines;

  return (
    <section className="relative overflow-hidden pt-28 pb-2 sm:pt-32 sm:pb-8 lg:pt-36">
      {/* The atmosphere: a shader under the whole hero, listening to the demo. */}
      <ShaderField voice={heroLevel} className="absolute inset-0" />

      {/* Words and voice on the left, the letter on the right: one picture. */}
      <div className="relative mx-auto w-full max-w-6xl px-6">
        <HeroDemo
          lead={
            <>
              <h1 className="font-display text-[3rem] leading-[1] font-medium sm:text-[3.8rem] lg:text-[4.6rem]">
                <span className="block">{first.map((w, i) => word(w, i))}</span>
                <span className="block">{second.map((w, i) => word(w, i + first.length))}</span>
              </h1>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 30 }}
              >
                <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
                  {t.hero.sub}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href={CONTACT}
                    className="btn-liquid-dark flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t.hero.primary}
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                  <a
                    href="#werkzeuge"
                    className="btn-liquid flex h-12 items-center gap-2 rounded-full border border-white/80 px-6 text-base font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t.hero.secondary}
                  </a>
                </div>
              </motion.div>
            </>
          }
        />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- shared -- */

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 220, damping: 30 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <Reveal>
      <h2 className="font-display max-w-[22ch] text-[2.2rem] leading-[1.04] font-medium text-balance sm:text-[2.8rem]">
        {title}
      </h2>
      {body ? <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-pretty text-muted-foreground">{body}</p> : null}
    </Reveal>
  );
}

/* ------------------------------------------------------------ vertrauen -- */

function Vertrauen() {
  const t = useCopy();
  const points = t.trust.points;
  return (
    <section className="border-t border-border py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-4">
          <h2 className="font-display text-[2.2rem] leading-[1.04] font-medium sm:text-[2.8rem]">{t.trust.title}</h2>
          <p className="mt-4 max-w-[30ch] text-lg leading-relaxed text-muted-foreground">
            {t.trust.body}
          </p>
        </Reveal>
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border lg:col-span-8">
          {points.map((x, i) => (
            <Reveal key={i} className={cn('sm:px-7', i === 0 && 'sm:ps-0', i === points.length - 1 && 'sm:pe-0')}>
              <h3 className="text-lg font-semibold tracking-tight">{x.t}</h3>
              <p className="mt-2.5 max-w-[34ch] leading-relaxed text-muted-foreground">{x.b}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- closing -- */

/**
 * The page ends in light. The closing words and the last key sit on a field
 * that runs to the bottom edge, and the footer line rests on the colour.
 */
function Closing() {
  const t = useCopy();
  return (
    <footer className="relative overflow-hidden">
      <ShaderField toEdge className="absolute inset-0" />
      <div className="relative mx-auto w-full max-w-6xl px-6 pt-28 pb-16 sm:pt-40">
        <Reveal className="text-center">
          <h2 className="font-display mx-auto max-w-[16ch] text-[2.4rem] leading-[1] font-medium text-balance sm:text-[4rem]">
            {t.closing.title}
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-pretty text-foreground/75">
            {t.closing.body}
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={CONTACT}
              className="btn-liquid-dark flex h-13 items-center gap-2 rounded-full px-8 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t.closing.cta}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </Reveal>

        <div className="mt-32 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-t border-foreground/10 pt-8 text-sm sm:mt-44">
          <div>
            <span className="flex items-center gap-1.5 font-medium">
              Arzt-Assistent
              <BrandWave transparent className="h-8 w-10 shrink-0" />
            </span>
            <p className="mt-1.5 text-foreground/75">{t.closing.tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-foreground/75">
            <a href="#werkzeuge" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {t.closing.tools}
            </a>
            <a href="#vorlagen" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {t.closing.templates}
            </a>
            <a href={CONTACT} className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {t.closing.contact}
            </a>
          </nav>
          <p className="text-foreground/75">© {new Date().getFullYear()} Arzt-Assistent</p>
        </div>
      </div>
    </footer>
  );
}
