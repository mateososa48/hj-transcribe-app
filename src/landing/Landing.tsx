import { useState, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { BorderBeam } from 'border-beam';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import { Bento } from './Bento';
import { HeroDemo } from './HeroDemo';
import { LiveRibbon } from './LiveRibbon';
import { Scrollytelling } from './Scrollytelling';

/**
 * The landing page: the product's own language doing the selling.
 *
 * Composition after studying lovable.dev properly — three moves borrowed and
 * translated into this product's clinical register:
 *
 * 1. An atmospheric colour field under the hero, mixed from the ribbon's own
 *    four spectral hues at restrained alpha — never their candy mesh.
 * 2. The hero IS the product running: a simulated dictation assembles a
 *    letter in real time, in the app's own visual grammar.
 * 3. One dark rounded slab carries all three tools as scrollytelling
 *    chapters, the real screenshots switching inside a single frame.
 *
 * No stock, no invented numbers, no testimonials. Everything collapses to
 * calm static layout under prefers-reduced-motion.
 */

const CONTACT = 'mailto:mateo_sosa@icloud.com?subject=Arzt-Assistent%20%E2%80%94%20Zugang';

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <FactBand />
        <Scrollytelling />
        <Bento />
        <Vorlagen />
        <Privacy />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ nav -- */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300',
        scrolled ? 'border-b border-border bg-background' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-6">
        <a href="#" className="flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <span className="text-[1.05rem] font-semibold tracking-tight">Arzt-Assistent</span>
          <BrandWave className="h-9 w-11 shrink-0" />
        </a>
        <nav className="ms-auto flex items-center gap-2">
          <a
            href="#werkzeuge"
            className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
          >
            Die Werkzeuge
          </a>
          <a
            href="#vorlagen"
            className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
          >
            Vorlagen
          </a>
          <a
            href={CONTACT}
            className="btn-liquid-dark flex h-10 items-center rounded-full px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
  const [beam, setBeam] = useState(false);

  const words = ['Sie', 'sprechen.'];
  const words2 = ['Der', 'Brief', 'schreibt', 'sich.'];
  const word = (w: string, i: number, italic = false) => (
    <motion.span
      key={w + i}
      initial={reduce ? false : { opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + i * 0.07, type: 'spring', stiffness: 320, damping: 30 }}
      className={cn('inline-block', italic && 'font-document italic')}
    >
      {w}&nbsp;
    </motion.span>
  );

  return (
    <section className="relative overflow-hidden">
      {/* The colour field: the ribbon's four hues, wide and quiet. It rises
          to meet the demo, not the wordmark — the page opens on clean white
          and gathers colour toward the machine at its centre. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-[16rem] left-[6%] size-[40rem] rounded-full bg-[#4230ff] opacity-[0.07] blur-[140px]" />
        <div className="absolute top-[20rem] right-[4%] size-[36rem] rounded-full bg-[#a52bd8] opacity-[0.06] blur-[140px]" />
        <div className="absolute top-[34rem] left-[28%] size-[38rem] rounded-full bg-[#d92a68] opacity-[0.055] blur-[150px]" />
        <div className="absolute top-[38rem] right-[24%] size-[30rem] rounded-full bg-[#b4700f] opacity-[0.05] blur-[140px]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-32 text-center sm:pt-40">
        <p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
          Für Ärztinnen und Ärzte
        </p>
        <h1 className="mx-auto mt-5 max-w-[16ch] text-[2.7rem] leading-[1.05] font-semibold tracking-[-0.02em] text-balance sm:text-6xl lg:text-[4.75rem]">
          {words.map((w, i) => word(w, i))}
          <span className="block">{words2.map((w, i) => word(w, i + words.length, true))}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed text-pretty text-muted-foreground">
          Diktat, Sprechstunde und Arztbrief — transkribiert, in Ihrem Stil formuliert, als
          Word-Datei exportiert. Aufnahmen und Briefe bleiben auf Ihrem Rechner.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <BorderBeam
            size="md"
            theme="dark"
            colorVariant="ocean"
            staticColors
            active={beam}
            borderRadius={24}
            duration={1.15}
            brightness={2.4}
            saturation={2.4}
            className="rounded-full"
          >
            <a
              href={CONTACT}
              onMouseEnter={() => setBeam(true)}
              onMouseLeave={() => setBeam(false)}
              className="btn-liquid-dark flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Früher Zugang
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </BorderBeam>
          <a
            href="#werkzeuge"
            className="btn-liquid flex h-12 items-center gap-2 rounded-full border border-white/80 px-6 text-base font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Die Werkzeuge
          </a>
        </div>

        {/* The product, running. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 220, damping: 30 }}
          className="mt-16"
        >
          <HeroDemo />
        </motion.div>
      </div>

      {/* The instrument itself carries the page into its first section. */}
      <LiveRibbon className="relative mx-auto -mt-6 h-32 w-full max-w-[88rem] sm:h-40" />
    </section>
  );
}

/* ------------------------------------------------------------ fact band -- */

const FACTS = [
  'Kein Konto',
  'Keine Cloud-Ablage',
  'Diktat wird Abschnitt',
  'Sprecher werden getrennt',
  'Word-Export mit echten Überschriften',
  'Eigene Vorlagen',
  'Sie geben jeden Satz frei',
];

function FactBand() {
  const row = (key: string) => (
    <div key={key} aria-hidden={key === 'b'} className="flex shrink-0 items-center">
      {FACTS.map((f) => (
        <span
          key={f}
          className="mx-6 flex items-center gap-6 text-xs font-medium tracking-[0.22em] whitespace-nowrap text-muted-foreground uppercase"
        >
          {f}
          <span className="size-1 rounded-full bg-border" aria-hidden />
        </span>
      ))}
    </div>
  );
  return (
    <div className="border-y border-border bg-background py-5 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] overflow-hidden">
      <div className="landing-marquee">{[row('a'), row('b')]}</div>
    </div>
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

/* ------------------------------------------------------------- vorlagen -- */

const TEMPLATES: Array<{ name: string; sections: string[] }> = [
  { name: 'Kardiologischer Arztbrief', sections: ['Diagnosen', 'Anamnese', 'Zusammenfassende Beurteilung', 'Aktuelle Therapie'] },
  { name: 'Kurzbefund Echo', sections: ['Fragestellung', 'Befund', 'Beurteilung'] },
  { name: 'Reha-Bericht', sections: ['Diagnosen', 'Verlauf', 'Empfehlung', 'Medikation'] },
  { name: 'Gutachten', sections: ['Fragestellung', 'Anamnese', 'Befunde', 'Beurteilung'] },
  { name: 'Überweisung', sections: ['Diagnosen', 'Fragestellung', 'Bisherige Therapie'] },
];

function Vorlagen() {
  return (
    <section id="vorlagen" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
            Vorlagen
          </p>
          <h2 className="mt-4 max-w-[22ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Ihre Abschnitte. <em className="font-document italic">Ihre Briefe.</em>
          </h2>
          <p className="mt-4 max-w-[50ch] text-lg leading-relaxed text-muted-foreground">
            Jede Praxis schreibt anders. Legen Sie eigene Berichtsvorlagen an — Abschnitte,
            Reihenfolge, Anrede — und jeder neue Brief beginnt genau so, wie Sie ihn schreiben
            würden.
          </p>
        </Reveal>
        <Reveal className="mt-12">
          <ul className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-6">
            {TEMPLATES.map((t) => (
              <li key={t.name}>
                <div className="group">
                  <span className="paper-mini block aspect-[3/4] px-4 pt-4 pb-3">
                    <span className="block text-[0.72rem] leading-snug font-bold underline underline-offset-2">
                      {t.name}
                    </span>
                    <span className="mt-2.5 block space-y-1.5">
                      {t.sections.map((s) => (
                        <span key={s} className="block">
                          <span className="block text-[0.6rem] font-bold">{s}</span>
                          <span className="mt-0.5 block h-1 w-full rounded-full bg-foreground/8" />
                          <span className="mt-0.5 block h-1 w-3/4 rounded-full bg-foreground/8" />
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="mt-2.5 block text-center text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                    {t.name}
                  </span>
                </div>
              </li>
            ))}
            <li>
              <a href={CONTACT} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <span className="flex aspect-[3/4] items-center justify-center rounded-[6px] border border-dashed border-foreground/25 text-muted-foreground transition-colors group-hover:border-foreground/50 group-hover:text-foreground">
                  <Plus className="size-6" aria-hidden />
                </span>
                <span className="mt-2.5 block text-center text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  Eigene Vorlage
                </span>
              </a>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- privacy -- */

function Privacy() {
  return (
    <section className="bg-black py-24 text-white sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.28em] text-white/50 uppercase">
            Vertrauen
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Bleibt bei Ihnen.
          </h2>
        </Reveal>
        <LiveRibbon dark className="mt-2 h-32 w-full sm:h-40" />
        <div className="mt-6 grid gap-10 sm:grid-cols-3">
          {[
            {
              t: 'Lokal gespeichert',
              b: 'Aufnahmen, Transkripte und Briefe liegen auf Ihrem Rechner — kein Konto, keine Cloud-Ablage, kein eigener Server.',
            },
            {
              t: 'Sie geben frei',
              b: 'Kein Satz erreicht den Brief ohne Ihre Durchsicht. Sie lesen, korrigieren und übernehmen — in dieser Reihenfolge.',
            },
            {
              t: 'Entwirft. Entscheidet nie.',
              b: 'Der Assistent formuliert Dokumentation. Er schlägt keine Diagnosen und keine Abrechnungsziffern vor — mit Absicht.',
            },
          ].map((x) => (
            <Reveal key={x.t}>
              <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Check className="size-4" aria-hidden />
                {x.t}
              </h3>
              <p className="mt-2.5 max-w-[38ch] leading-relaxed text-white/65">{x.b}</p>
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
    <section className="py-28 sm:py-40">
      <div className="mx-auto w-full max-w-6xl px-6 text-center">
        <LiveRibbon className="mx-auto h-24 w-full max-w-3xl" />
        <Reveal>
          <h2 className="mx-auto mt-4 max-w-[16ch] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Weniger Tastatur. <em className="font-document italic">Mehr Medizin.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-lg leading-relaxed text-muted-foreground">
            Arzt-Assistent wird derzeit mit einer kleinen Gruppe von Ärztinnen und Ärzten
            erprobt. Schreiben Sie uns, wenn Sie dabei sein möchten.
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={CONTACT}
              className="btn-liquid-dark flex h-13 items-center gap-2 rounded-full px-8 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Früher Zugang anfragen
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
          <BrandWave className="h-8 w-10 shrink-0" />
        </span>
        <span className="ms-auto">© {new Date().getFullYear()} · Für Ärztinnen und Ärzte gemacht.</span>
      </div>
    </footer>
  );
}
