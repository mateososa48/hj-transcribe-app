import { useState, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import { Bento } from './Bento';
import { HeroDemo } from './HeroDemo';
import { LiveRibbon } from './LiveRibbon';
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
      <Nav />
      <main>
        <Hero />
        <Statement />
        <Scrollytelling />
        <Bento heading={<SectionHeading title="Die Details, an denen man Sorgfalt erkennt." />} />
        <Vorlagen
          contact={CONTACT}
          heading={
            <SectionHeading
              title="Ihre Abschnitte. Ihre Briefe."
              body="Jede Praxis schreibt anders. Legen Sie eigene Berichtsvorlagen an, mit Ihren Abschnitten, Ihrer Reihenfolge und Ihrer Anrede. Jeder neue Brief beginnt genau so, wie Sie ihn schreiben würden."
            />
          }
        />
        <Vertrauen />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ nav -- */

function Nav() {
  // Read the real position on mount: the page may open already scrolled.
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  const link = 'hidden rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block';

  return (
    <header className="fixed inset-x-3 top-3 z-50 sm:inset-x-4 sm:top-4">
      <div
        className={cn(
          // Solid when scrolled, not glass: the mark paints an opaque white
          // ground and can only multiply cleanly onto a fully white pill.
          'mx-auto flex h-14 w-full max-w-5xl items-center gap-1 rounded-full border ps-5 pe-2 transition-[background-color,border-color,box-shadow] duration-300',
          scrolled
            ? 'border-border bg-background shadow-[0_1px_2px_rgba(12,12,13,0.04),0_12px_32px_-16px_rgba(12,12,13,0.22)]'
            : 'border-transparent bg-transparent',
        )}
      >
        <a href="#" className="flex items-center gap-1.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <span className="text-[1.05rem] font-semibold tracking-tight">Arzt-Assistent</span>
          {/* The mark paints an opaque white ground; multiply lets it sit on
              the glass pill and the shader field without a box. */}
          <BrandWave className="h-9 w-11 shrink-0 mix-blend-multiply" />
        </a>
        <nav className="ms-auto flex items-center gap-1">
          <a href="#werkzeuge" className={link}>
            Die Werkzeuge
          </a>
          <a href="#vorlagen" className={link}>
            Vorlagen
          </a>
          <a
            href={CONTACT}
            className="btn-liquid-dark ms-1 flex h-10 items-center rounded-full px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Früher Zugang
          </a>
        </nav>
      </div>
    </header>
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
    <section className="relative overflow-hidden pt-28 pb-10 sm:pt-32 sm:pb-8 lg:pt-36">
      {/* The atmosphere: a shader under the whole hero, listening to the demo. */}
      <ShaderField voice={heroLevel} className="absolute inset-0" />

      {/* Words and voice on the left, the letter on the right: one picture. */}
      <div className="relative mx-auto w-full max-w-6xl px-6">
        <HeroDemo
          lead={
            <>
              <h1 className="font-display text-[3rem] leading-[1] font-semibold sm:text-[3.8rem] lg:text-[4.5rem]">
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

/* ------------------------------------------------------------ statement -- */

function Statement() {
  return (
    <section className="pt-10 pb-24 sm:pt-16 sm:pb-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <p className="font-display max-w-[34ch] text-[1.6rem] leading-[1.15] font-semibold text-balance sm:text-[2.5rem] sm:leading-[1.12]">
            Drei Werkzeuge, ein Brief.{' '}
            <span className="text-muted-foreground">
              Das Diktat wird zur Beurteilung, das Gespräch zu Notizen, die Seite zur Word-Datei.
              Jeder Satz geht durch Ihre Hände, bevor er im Brief steht.
            </span>
          </p>
        </Reveal>
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
      <h2 className="font-display max-w-[22ch] text-[2.2rem] leading-[1.04] font-semibold text-balance sm:text-[2.8rem]">
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
          <h2 className="font-display text-[2.2rem] leading-[1.04] font-semibold sm:text-[2.8rem]">Bleibt bei Ihnen.</h2>
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

/* ------------------------------------------------------------ final cta -- */

function FinalCta() {
  return (
    <section className="overflow-hidden pt-10 pb-28 sm:pt-12 sm:pb-40">
      <div className="relative">
        {/* The instrument's reprise sits above the words, never through them. */}
        <LiveRibbon className="pointer-events-none relative -mb-20 h-[16rem] w-full sm:-mb-24 sm:h-[20rem]" />
        <Reveal className="relative mx-auto w-full max-w-6xl px-6 text-center">
          <h2 className="font-display mx-auto max-w-[16ch] text-[2.8rem] leading-[1] font-semibold text-balance sm:text-[4rem]">
            Weniger Tastatur. Mehr Medizin.
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-pretty text-muted-foreground">
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
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-4 px-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          Arzt-Assistent
          <BrandWave className="h-8 w-10 shrink-0 mix-blend-multiply" />
        </span>
        <span className="ms-auto">© {new Date().getFullYear()} Arzt-Assistent. Für Ärztinnen und Ärzte gemacht.</span>
      </div>
    </footer>
  );
}
