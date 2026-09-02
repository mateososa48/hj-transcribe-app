import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import { Bento } from './Bento';
import { Genauigkeit } from './Genauigkeit';
import { HeroDemo } from './HeroDemo';
import { Nav } from './Nav';
import { Scrollytelling } from './Scrollytelling';
import { ShaderField } from './ShaderField';
import { Vorlagen } from './Vorlagen';
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
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Nav contact={CONTACT} />
      <main>
        <Hero />
        <Scrollytelling />
        <Genauigkeit />
        <Bento heading={<SectionHeading title="Die Details, an denen man Sorgfalt erkennt." />} />
        <Vorlagen
          heading={
            <SectionHeading
              title="Ihre Abschnitte. Ihre Briefe."
              body="Jede Praxis schreibt anders. Legen Sie eigene Berichtsvorlagen an: Abschnitte hinzufügen, umsortieren, benennen. Jeder neue Brief beginnt so, wie Sie ihn schreiben würden."
            />
          }
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

  const word = (w: string, i: number) => (
    <motion.span
      key={w + i}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.06, type: 'spring', stiffness: 320, damping: 30 }}
      className="inline-block"
    >
      {w}&nbsp;
    </motion.span>
  );
  const first = ['Sie', 'sprechen.'];
  const second = ['Der', 'Brief', 'schreibt', 'sich.'];

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
                  Diktat, Sprechstunde und Arztbrief: transkribiert, in Ihrem Stil formuliert, als
                  Word-Datei exportiert. Alles bleibt auf Ihrem Rechner.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href={CONTACT}
                    className="btn-liquid-dark flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Früher Zugang
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                  <a
                    href="#werkzeuge"
                    className="btn-liquid flex h-12 items-center gap-2 rounded-full border border-white/80 px-6 text-base font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Die Werkzeuge
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

const POINTS = [
  {
    t: 'Lokal gespeichert',
    b: 'Aufnahmen, Transkripte und Briefe liegen auf Ihrem Rechner. Kein Konto, keine Cloud-Ablage, kein eigener Server.',
  },
  {
    t: 'Sie geben frei',
    b: 'Kein Satz erreicht den Brief ohne Ihre Durchsicht. Sie lesen, korrigieren und übernehmen, in dieser Reihenfolge.',
  },
  {
    t: 'Entwirft. Entscheidet nie.',
    b: 'Der Assistent formuliert Dokumentation. Er schlägt keine Diagnosen und keine Abrechnungsziffern vor, mit Absicht.',
  },
];

function Vertrauen() {
  return (
    <section className="border-t border-border py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-4">
          <h2 className="font-display text-[2.2rem] leading-[1.04] font-medium sm:text-[2.8rem]">Bleibt bei Ihnen.</h2>
          <p className="mt-4 max-w-[30ch] text-lg leading-relaxed text-muted-foreground">
            Drei Grundsätze, die im Werkzeug selbst stecken, nicht in einer Vereinbarung.
          </p>
        </Reveal>
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border lg:col-span-8">
          {POINTS.map((x, i) => (
            <Reveal key={x.t} className={cn('sm:px-7', i === 0 && 'sm:ps-0', i === POINTS.length - 1 && 'sm:pe-0')}>
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
  return (
    <footer className="relative overflow-hidden">
      <ShaderField toEdge className="absolute inset-0" />
      <div className="relative mx-auto w-full max-w-6xl px-6 pt-28 pb-8 sm:pt-40">
        <Reveal className="text-center">
          <h2 className="font-display mx-auto max-w-[16ch] text-[2.4rem] leading-[1] font-medium text-balance sm:text-[4rem]">
            Weniger Tastatur. Mehr Medizin.
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-pretty text-foreground/75">
            Arzt-Assistent wird derzeit mit einer kleinen Gruppe von Ärztinnen und Ärzten erprobt.
            Schreiben Sie uns, wenn Sie dabei sein möchten.
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={CONTACT}
              className="btn-liquid-dark flex h-13 items-center gap-2 rounded-full px-8 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Früher Zugang
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </Reveal>

        <div className="mt-32 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-t border-foreground/10 pt-8 text-sm sm:mt-44">
          <div>
            <span className="flex items-center gap-1.5 font-medium">
              Arzt-Assistent
              <BrandWave className="h-8 w-10 shrink-0 mix-blend-multiply" />
            </span>
            <p className="mt-1.5 text-foreground/75">Für Ärztinnen und Ärzte gemacht.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-foreground/75">
            <a href="#werkzeuge" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Die Werkzeuge
            </a>
            <a href="#vorlagen" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Vorlagen
            </a>
            <a href={CONTACT} className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Kontakt
            </a>
          </nav>
          <p className="text-foreground/75">© {new Date().getFullYear()} Arzt-Assistent</p>
        </div>
      </div>
    </footer>
  );
}
