import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';

/**
 * The floating pill.
 *
 * Resting on the hero it is transparent, a row of items on the page's own
 * grid: the wordmark on the content's left edge, the key on its right edge.
 * Once the page moves it becomes a solid white pill, a little lower in
 * height, and it steps out of the way while you scroll down and returns the
 * moment you scroll up. One highlight slides between the section links,
 * following the pointer, and otherwise rests on the section you are in.
 */

const ITEMS = [
  { id: 'werkzeuge', label: 'Die Werkzeuge' },
  { id: 'vorlagen', label: 'Vorlagen' },
] as const;

export function Nav({ contact }: { contact: string }) {
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const last = useRef(window.scrollY);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 24);
    const dy = y - last.current;
    // Out of the way on the way down, back on the first move up. Never
    // hidden near the top, where it belongs to the hero.
    if (y < 96) setHidden(false);
    else if (dy > 8) setHidden(true);
    else if (dy < -8) setHidden(false);
    last.current = y;
  });

  // Which section crosses the middle of the viewport.
  useEffect(() => {
    const els = ITEMS.map((it) => document.getElementById(it.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? null : cur));
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-3 z-50 sm:top-4',
        !reduce && 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        hidden && '-translate-y-[140%]',
      )}
    >
      {/* Same container as the content, so the wordmark sits on the page's
          left edge and the key on its right edge; the pill reaches past both
          by exactly its own padding. Solid when scrolled, not glass: the mark
          paints an opaque white ground and multiplies cleanly only on white. */}
      <div
        className={cn(
          'mx-auto flex w-[calc(100%-1rem)] max-w-[calc(72rem-1rem)] items-center gap-1 rounded-full border ps-4 pe-4 transition-[height,background-color,border-color,box-shadow] duration-300',
          scrolled
            ? 'h-12 border-border bg-background shadow-[0_1px_2px_rgba(12,12,13,0.04),0_12px_32px_-16px_rgba(12,12,13,0.22)]'
            : 'h-14 border-transparent bg-transparent',
        )}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          aria-label="Arzt-Assistent, zum Seitenanfang"
          className="flex cursor-pointer items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="text-[1.05rem] font-semibold tracking-tight">Arzt-Assistent</span>
          <BrandWave className="h-10 w-12 shrink-0 mix-blend-multiply" />
        </button>

        <nav aria-label="Abschnitte" onMouseLeave={() => setHover(null)} className="ms-auto flex items-center gap-0.5">
          {ITEMS.map((it) => {
            const lit = hover ? hover === it.id : active === it.id;
            return (
              <a
                key={it.id}
                href={`#${it.id}`}
                aria-current={active === it.id ? 'location' : undefined}
                onMouseEnter={() => setHover(it.id)}
                onFocus={() => setHover(it.id)}
                onBlur={() => setHover(null)}
                className={cn(
                  'relative hidden rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:block',
                  lit ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {lit ? (
                  <motion.span
                    layoutId="nav-highlight"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-muted"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
                  />
                ) : null}
                <span className="relative">{it.label}</span>
              </a>
            );
          })}
          <a
            href={contact}
            className={cn(
              'btn-liquid-dark ms-2 flex items-center rounded-full px-4 text-sm font-medium text-white transition-[height] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              scrolled ? 'h-9' : 'h-10',
            )}
          >
            Früher Zugang
          </a>
        </nav>
      </div>
    </header>
  );
}
