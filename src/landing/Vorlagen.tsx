import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, Reorder, useReducedMotion } from 'motion/react';
import { GripVertical, Mic, Plus, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Report templates as a small working editor beside the letter it shapes.
 *
 * Five report types as tabs, the active template's sections as rows that can
 * be dragged into a new order, an input that adds a section, a blank
 * template for your own. The letter on the right follows every change: its
 * sections slide into their new order, new ones arrive with a real line or
 * two, removed ones leave. Which is what the feature does to a Bericht.
 *
 * Until the reader touches it, the tabs advance on their own; under reduced
 * motion nothing advances and nothing travels, but everything still works.
 */

interface Template {
  id: string;
  name: string;
  sections: string[];
}

const TEMPLATES: Template[] = [
  { id: 'arztbrief', name: 'Kardiologischer Arztbrief', sections: ['Diagnosen', 'Anamnese', 'Zusammenfassende Beurteilung', 'Aktuelle Therapie'] },
  { id: 'echo', name: 'Kurzbefund Echo', sections: ['Fragestellung', 'Befund', 'Beurteilung'] },
  { id: 'reha', name: 'Reha-Bericht', sections: ['Diagnosen', 'Verlauf', 'Empfehlung', 'Medikation'] },
  { id: 'gutachten', name: 'Gutachten', sections: ['Fragestellung', 'Anamnese', 'Befunde', 'Beurteilung'] },
  { id: 'ueberweisung', name: 'Überweisung', sections: ['Diagnosen', 'Fragestellung', 'Bisherige Therapie'] },
  { id: 'eigene', name: 'Eigene Vorlage', sections: [] },
];

/** A line or two of letter per known section, so a template reads as a letter. */
const LINES: Record<string, string[]> = {
  Diagnosen: ['1. Koronare Herzkrankheit, Z. n. PCI/Stent RIVA 03/2026', '2. Arterielle Hypertonie'],
  Anamnese: ['Seit dem Eingriff keine Angina pectoris, gute Belastbarkeit im Alltag.'],
  'Zusammenfassende Beurteilung': ['Stabiler Verlauf. Die Medikation wird unverändert fortgeführt.'],
  'Aktuelle Therapie': ['ASS 100   1-0-0', 'Clopidogrel 75  1-0-0 bis 5/26'],
  Fragestellung: ['LV-Funktion? Klappenvitien?'],
  Befund: ['LVEF 58 %, keine regionalen Wandbewegungsstörungen, Klappen unauffällig.'],
  Beurteilung: ['Altersentsprechender Normalbefund.'],
  Verlauf: ['Belastbarkeit im Ergometer von 75 auf 100 Watt gesteigert.'],
  Empfehlung: ['Fortführung der Bewegungstherapie, Kontrolle in 6 Monaten.'],
  Medikation: ['Bisoprolol 2,5   1-0-0', 'Atorvastatin 40  0-0-1'],
  Befunde: ['Echokardiographie und Belastungs-EKG ohne pathologischen Befund.'],
  'Bisherige Therapie': ['Konservativ, Beschwerdefreiheit unter Medikation.'],
};

const DWELL_MS = 4200;
const AUTO_COUNT = TEMPLATES.length - 1; // the blank one is yours, not the tour's

export function Vorlagen({ heading }: { heading: ReactNode }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [orders, setOrders] = useState<Record<string, string[]>>(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, t.sections])));
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState('');
  const hostRef = useRef<HTMLElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const template = TEMPLATES[active]!;
  const sections = orders[template.id] ?? [];
  const touch = () => setTouched(true);
  const setSections = (next: string[]) => setOrders((o) => ({ ...o, [template.id]: next }));

  // The tour: tabs advance while on screen and untouched.
  useEffect(() => {
    if (reduce || touched) return;
    const host = hostRef.current;
    if (!host) return;
    let timer = 0;
    let onscreen = false;
    const run = () => {
      window.clearInterval(timer);
      if (onscreen && document.visibilityState === 'visible') {
        timer = window.setInterval(() => setActive((i) => (i + 1) % AUTO_COUNT), DWELL_MS);
      }
    };
    const observer = new IntersectionObserver(
      ([e]) => {
        onscreen = e?.isIntersecting ?? false;
        run();
      },
      { threshold: 0.4 },
    );
    observer.observe(host);
    document.addEventListener('visibilitychange', run);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', run);
      window.clearInterval(timer);
    };
  }, [reduce, touched]);

  // On phones the tabs are a row; keep the lit one in view as the tour moves.
  useEffect(() => {
    const list = tabsRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const left = item.offsetLeft - list.offsetLeft;
    const right = left + item.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 8), behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [active, reduce]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || sections.includes(name)) return;
    setSections([...sections, name]);
    setDraft('');
    touch();
  };
  const remove = (s: string) => {
    setSections(sections.filter((x) => x !== s));
    touch();
  };

  return (
    <section ref={hostRef} id="vorlagen" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6">
        {heading}

        {/* The report types. */}
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Berichtsvorlagen"
          className="-mx-2 mt-10 flex gap-2 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0"
        >
          {TEMPLATES.map((t, i) => {
            const on = i === active;
            const blank = t.id === 'eigene';
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="vorlage-editor"
                onClick={() => {
                  setActive(i);
                  touch();
                }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  on
                    ? 'border-foreground bg-foreground text-background'
                    : blank
                      ? 'border-dashed border-foreground/30 text-muted-foreground hover:border-foreground/60 hover:text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {blank ? <Plus className="size-3.5" aria-hidden /> : null}
                {t.name}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
          {/* The editor: the template as rows you can hold. */}
          <div
            id="vorlage-editor"
            role="tabpanel"
            // min-w-0: as a grid item its intrinsic width (the input row) must
            // not widen the track past the phone's viewport.
            className="min-w-0 rounded-3xl border border-border bg-background p-5 shadow-[0_1px_2px_rgba(12,12,13,0.04),0_24px_60px_-40px_rgba(12,12,13,0.25)] sm:p-6 lg:col-span-5"
            onPointerDownCapture={touch}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-muted-foreground">Vorlage</p>
              <p className="truncate text-sm font-semibold">{template.name}</p>
            </div>

            {sections.length > 0 ? (
              <Reorder.Group axis="y" values={sections} onReorder={setSections} className="mt-4 space-y-1.5">
                {sections.map((s) => (
                  <Reorder.Item
                    key={s}
                    value={s}
                    {...(reduce ? {} : { layout: 'position' as const })}
                    whileDrag={{ scale: 1.02, boxShadow: '0 16px 40px -16px rgba(12,12,13,0.45)' }}
                    className="group flex cursor-grab items-center gap-3 rounded-xl border border-transparent bg-muted/70 px-3 py-2.5 text-sm font-medium select-none hover:border-border active:cursor-grabbing"
                  >
                    <GripVertical className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{s}</span>
                    <Mic className="size-3.5 shrink-0 text-muted-foreground/60" aria-label="Einzeln diktierbar" />
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      aria-label={`${s} entfernen`}
                      className="rounded-md p-0.5 text-transparent transition-colors group-hover:text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Noch keine Abschnitte. Fügen Sie den ersten hinzu.
              </p>
            )}

            <form onSubmit={add} className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Abschnitt hinzufügen, z. B. Empfehlung"
                aria-label="Neuer Abschnitt"
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-foreground/40"
              />
              <button
                type="submit"
                className="btn-liquid-dark flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus className="size-4" aria-hidden />
                Hinzufügen
              </button>
            </form>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Ziehen Sie einen Abschnitt, um die Reihenfolge zu ändern. Jeder Abschnitt lässt sich im Bericht einzeln diktieren.
            </p>
          </div>

          {/* The letter, following every change. */}
          <div className="min-w-0 lg:col-span-7">
            <div className="paper-mini mx-auto max-w-xl px-8 py-8 sm:px-10 sm:py-10">
              <div className="font-document text-[0.98rem] leading-[1.75]">
                <p className="text-foreground/60">Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege,</p>
                <p className="mb-[0.7em] text-foreground/60">wir berichten über die oben genannte Patientin.</p>
                <AnimatePresence initial={false} mode="popLayout">
                  {sections.map((s) => (
                    <motion.div
                      key={s}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                      className="mb-[0.6em]"
                    >
                      <p className="font-bold underline underline-offset-4">{s}</p>
                      {LINES[s] ? (
                        LINES[s].map((line) => (
                          <p key={line} className="whitespace-pre-wrap">
                            {line}
                          </p>
                        ))
                      ) : (
                        <div className="mt-1.5 space-y-1.5" aria-hidden>
                          <span className="block h-1.5 w-full rounded-full bg-foreground/8" />
                          <span className="block h-1.5 w-[70%] rounded-full bg-foreground/8" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {sections.length === 0 ? (
                  <p className="mb-[0.6em] text-foreground/40">Der Brief wartet auf seinen ersten Abschnitt.</p>
                ) : null}
                <p className="mt-[0.9em] text-foreground/60">Mit freundlichen kollegialen Grüßen</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
