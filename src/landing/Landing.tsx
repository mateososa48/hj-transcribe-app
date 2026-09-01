import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { ArrowDown, ArrowRight, Check, FileText, Mic, Plus, Stethoscope } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import { LiveRibbon } from './LiveRibbon';

/**
 * The landing page: the product's own language doing the selling.
 *
 * Everything visual here is the app's — Geist for the interface voice, the
 * document face for anything that is "letter", the one black glass material
 * for keys, paper on a grey desk for product shots, and the spectral ribbon
 * as the single atmospheric asset. No stock, no invented statistics, no
 * testimonials: real screenshots and the real shader.
 *
 * Four signature motion moments, restrained baseline everywhere else:
 * word-staggered headline, the live ribbon, parallax product shots, and the
 * scroll-pinned Diktat→Brief transformation. All of it collapses to calm
 * static layout under prefers-reduced-motion.
 */

const CONTACT = 'mailto:mateo_sosa@icloud.com?subject=Arzt-Assistent%20%E2%80%94%20Zugang';

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <FactBand />
        <section id="werkzeuge" className="scroll-mt-24">
          <FeatureDiktat />
          <FeatureTermin />
          <FeatureBericht />
        </section>
        <Transformation />
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
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled ? 'border-b border-border bg-background' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[76rem] items-center gap-3 px-6">
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
  const shotRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: shotRef, offset: ['start end', 'end start'] });
  const shotY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const line1 = ['Sie', 'sprechen.'];
  const line2 = ['Der', 'Brief', 'schreibt', 'sich.'];
  const word = (w: string, i: number, italic = false) => (
    <motion.span
      key={w + i}
      initial={reduce ? false : { opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + i * 0.07, type: 'spring', stiffness: 320, damping: 30 }}
      className={cn('inline-block', italic && 'font-document italic')}
    >
      {w}&nbsp;
    </motion.span>
  );

  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mx-auto w-full max-w-[76rem] px-6">
        <p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
          Für Ärztinnen und Ärzte
        </p>
        <h1 className="mt-5 max-w-[13ch] text-[2.6rem] leading-[1.04] font-semibold tracking-[-0.02em] text-balance sm:text-6xl lg:text-7xl">
          <span className="block">{line1.map((w, i) => word(w, i))}</span>
          <span className="block">{line2.map((w, i) => word(w, i + line1.length, true))}</span>
        </h1>
        <div className="mt-8">
          <p className="max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
            Arzt-Assistent macht aus Diktat und Sprechstunde fertige Arztbriefe — transkribiert,
            in Ihrem Stil formuliert und als Word-Datei exportiert. Aufnahmen und Briefe bleiben
            auf Ihrem Rechner.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
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
              Ansehen
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>

      {/* The instrument itself: the app's WebGL ribbon, spoken to. */}
      <LiveRibbon className="mx-auto mt-6 h-36 w-full max-w-[88rem] sm:h-44" />

      {/* The letter on the desk. Real screenshot, slight parallax. */}
      <div className="bg-muted/50 pb-24 sm:pb-32">
        <div ref={shotRef} className="mx-auto w-full max-w-[76rem] px-6">
          <motion.figure style={{ y: reduce ? 0 : shotY }} className="app-shot -mt-2">
            <img
              src="/landing/bericht.webp"
              width={3200}
              height={1612}
              alt="Arzt-Assistent: ein Arztbrief als Seite, mit Diktaten in der Randspalte"
              fetchPriority="high"
            />
          </motion.figure>
          <figcaption className="mt-4 text-center text-sm text-muted-foreground">
            Ein echter Blick in die Anwendung — der Brief als Seite, die Diktate daneben.
          </figcaption>
        </div>
      </div>
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

/* ------------------------------------------------------------- features -- */

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

function FeatureBlock({
  icon: Icon,
  eyebrow,
  title,
  body,
  points,
  img,
  alt,
  flip = false,
  desk = false,
}: {
  icon: typeof Mic;
  eyebrow: string;
  title: ReactNode;
  body: string;
  points: string[];
  img: string;
  alt: string;
  flip?: boolean;
  desk?: boolean;
}) {
  return (
    <section className={cn('py-24 sm:py-32', desk && 'bg-muted/50')}>
      <div className="mx-auto grid w-full max-w-[76rem] items-center gap-12 px-6 lg:grid-cols-12 lg:gap-8">
        <Reveal className={cn('lg:col-span-5', flip && 'lg:order-2 lg:col-start-8')}>
          <p className="flex items-center gap-2 text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
            <Icon className="size-4" aria-hidden />
            {eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-muted-foreground">{body}</p>
          <ul className="mt-6 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-base">
                <Check className="mt-1 size-4 shrink-0" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className={cn('lg:col-span-7', flip && 'lg:order-1 lg:col-start-1')}>
          <figure className="app-shot">
            <img src={img} width={3200} height={1612} alt={alt} loading="lazy" />
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureDiktat() {
  return (
    <FeatureBlock
      icon={Mic}
      eyebrow="Diktat"
      title={
        <>
          Frei sprechen.{' '}
          <em className="font-document italic">Fertig formuliert.</em>
        </>
      }
      body="Sie sprechen über den Fall wie zu einer Kollegin. Daraus entsteht die Zusammenfassende Beurteilung — vollständige Sätze, Ihre Reihenfolge, Ihre Formulierungen."
      points={[
        'Nachdiktieren statt neu diktieren: Ergänzungen werden eingearbeitet.',
        'Aufnahme und Transkript bleiben zum Nachhören daneben.',
        'Kopieren fügt in Word echte Aufzählungen ein, keine Spiegelstriche.',
      ]}
      img="/landing/diktat.webp"
      alt="Ein Diktat, als fertige Zusammenfassende Beurteilung formuliert"
    />
  );
}

function FeatureTermin() {
  return (
    <FeatureBlock
      icon={Stethoscope}
      eyebrow="Sprechstunde"
      title={
        <>
          Das Gespräch <em className="font-document italic">schreibt mit.</em>
        </>
      }
      body="Während Sie beim Patienten sind, läuft die Aufnahme mit. Danach: das Transkript nach Sprechern getrennt, die Aufnahme zum Nachhören und fertige Notizen in Abschnitten."
      points={[
        'Sprecher werden automatisch getrennt und benannt.',
        'Ein Klick auf ein Wort springt an die Stelle in der Aufnahme.',
        'Notizen bleiben belegbar: die Quelle steht immer daneben.',
      ]}
      img="/landing/transkript.webp"
      alt="Ein Sprechstunden-Transkript, nach Arzt und Patient getrennt"
      flip
      desk
    />
  );
}

function FeatureBericht() {
  return (
    <FeatureBlock
      icon={FileText}
      eyebrow="Bericht"
      title={
        <>
          Der Brief <em className="font-document italic">als Seite.</em>
        </>
      }
      body="Ein Arztbrief wie in Word: eine A4-Seite mit Ihren Abschnitten. Jeder Abschnitt lässt sich einzeln diktieren — Sie nennen ihn beim Namen, der Text landet an der richtigen Stelle."
      points={[
        'Diktieren Sie „Diagnosen" — und Diagnosen füllt sich.',
        'Abschnitte aus Diktaten und Sprechstunden übernehmen.',
        'Als Word-Datei exportieren: echte Überschriften, echte Tabstopps.',
      ]}
      img="/landing/bericht.webp"
      alt="Der Berichtseditor: eine A4-Seite mit diktierbaren Abschnitten"
    />
  );
}

/* ------------------------------------------- pinned transformation ------ */

const SPOKEN = 'Aktuelle Therapie: ASS hundert eins null null, Clopidogrel fünfundsiebzig eins null null bis Mai sechsundzwanzig.'.split(' ');

const LETTER_LINES = [
  { text: 'Aktuelle Therapie', heading: true },
  { text: 'ASS 100  1-0-0' },
  { text: 'Clopidogrel 75  1-0-0 bis 5/26' },
];

/**
 * The one scroll-pinned moment: a spoken sentence becomes letter lines.
 * Three beats — gesprochen, verstanden, formuliert — driven directly by
 * scroll progress, so he controls the transformation with his thumb.
 * Under reduced motion (or on small screens) the three beats simply stand
 * finished, stacked.
 */
function Transformation() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(v));

  const done = reduce;
  const lit = done ? SPOKEN.length : Math.round(Math.min(1, p / 0.34) * SPOKEN.length);
  const understood = done || p > 0.4;
  const linesShown = done ? LETTER_LINES.length : Math.max(0, Math.ceil(((p - 0.52) / 0.4) * LETTER_LINES.length));

  const inner = (
    <div className="mx-auto grid w-full max-w-[76rem] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
      {/* Gesprochen */}
      <div>
        <p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
          Gesprochen
        </p>
        <p className="mt-5 max-w-[34ch] text-2xl leading-[1.7] font-medium sm:text-[1.7rem]">
          {SPOKEN.map((w, i) => (
            <span
              key={i}
              className={cn(
                'transition-colors duration-200',
                i < lit ? 'text-foreground' : 'text-foreground/20',
              )}
            >
              {w}{' '}
            </span>
          ))}
        </p>
        <p
          className={cn(
            'mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-opacity duration-300',
            understood ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Check className="size-4" aria-hidden />
          Abschnitt erkannt: „Aktuelle Therapie"
        </p>
      </div>

      {/* Formuliert — paper, the document face. */}
      <div>
        <p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
          Im Brief
        </p>
        <div className="paper-mini mt-5 min-h-[16rem] px-8 py-7 sm:px-10 sm:py-9">
          <div className="font-document text-lg leading-[1.9] sm:text-xl">
            {LETTER_LINES.map((line, i) => (
              <p
                key={line.text}
                className={cn(
                  'whitespace-pre transition-all duration-300',
                  line.heading && 'font-bold underline underline-offset-4',
                  i < linesShown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                )}
              >
                {line.text}
              </p>
            ))}
            <span
              className={cn(
                'mt-1 inline-block h-6 w-[2px] bg-foreground/70 align-middle',
                linesShown >= LETTER_LINES.length && !reduce && 'animate-pulse',
                linesShown === 0 && 'opacity-0',
              )}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section aria-label="Vom gesprochenen Wort zum Brief" className="border-y border-border bg-background">
      <div className="mx-auto w-full max-w-[76rem] px-6 pt-24 sm:pt-32">
        <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Vom gesprochenen Wort <em className="font-document italic">zum Brief.</em>
        </h2>
        <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
          Gesprochene Zahlen werden Dosierungen, genannte Abschnitte werden Überschriften — und
          nichts wird erfunden: Was Sie nicht gesagt haben, steht auch nicht im Brief.
        </p>
      </div>
      {done ? (
        <div className="py-20">{inner}</div>
      ) : (
        <div ref={ref} className="h-[300vh]">
          <div className="sticky top-0 flex min-h-screen items-center py-24">{inner}</div>
        </div>
      )}
    </section>
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
    <section id="vorlagen" className="scroll-mt-24 bg-muted/50 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[76rem] px-6">
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
                <a href={CONTACT} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
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
                </a>
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
      <div className="mx-auto w-full max-w-[76rem] px-6">
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
              <h3 className="text-lg font-semibold tracking-tight">{x.t}</h3>
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
      <div className="mx-auto w-full max-w-[76rem] px-6 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-[16ch] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
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
      <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center gap-x-3 gap-y-4 px-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          Arzt-Assistent
          <BrandWave className="h-8 w-10 shrink-0" />
        </span>
        <span className="ms-auto">© {new Date().getFullYear()} · Für Ärztinnen und Ärzte gemacht.</span>
      </div>
    </footer>
  );
}

/** Scroll restoration off — a marketing page always opens at the top. */
export function useTopOnLoad() {
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);
}
