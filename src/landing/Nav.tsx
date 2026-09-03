import { useEffect, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';

/**
 * The header.
 *
 * Resting on the hero it is a transparent row on the page's own grid: the
 * wordmark on the content's left edge, the key on its right edge. Once the
 * page moves it gathers into a narrower pill of white glass and stays on
 * screen. The mark is painted on a transparent canvas, so it never carries a
 * white ground onto whatever is behind the header. One highlight slides
 * between the section links, following the pointer, and otherwise rests on
 * the section that crosses the middle of the viewport.
 *
 * The key sits concentric with the pill in both states: its inset from the
 * pill's right edge equals its inset from the top and bottom.
 */

const ITEMS = [
  { id: 'werkzeuge', label: 'Die Werkzeuge' },
  { id: 'vorlagen', label: 'Vorlagen' },
] as const;

export function Nav({ contact }: { contact: string }) {
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

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
    <header className="fixed inset-x-0 top-3 z-50 sm:top-4">
      <div
        className={cn(
          // At rest the row is the content column itself (max-w-6xl, px-6), so
          // the wordmark and the key sit on the hero's own text edges. Once
          // moving it gathers into a narrower pill: height 64 → 56, key 44,
          // so the key's inset from the pill's right edge (padding + 1px
          // border) equals its inset from the top and bottom: 6px.
          'mx-auto flex items-center gap-1 rounded-full border transition-[max-width,width,height,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          scrolled
            ? 'nav-glass h-14 w-[calc(100%-2.5rem)] max-w-[52rem] border-white/80 ps-5 pe-[calc(0.375rem-1px)]'
            : 'h-16 w-full max-w-6xl border-transparent bg-transparent px-[calc(1.5rem-1px)]',
        )}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          aria-label="Arzt-Assistent, zum Seitenanfang"
          className="flex cursor-pointer items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="text-[1.05rem] font-semibold tracking-tight">Arzt-Assistent</span>
          <BrandWave transparent className="h-10 w-12 shrink-0" />
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
                    className="absolute inset-0 rounded-full bg-white/70 shadow-[0_0_0_1px_rgba(12,12,13,0.05)]"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
                  />
                ) : null}
                <span className="relative">{it.label}</span>
              </a>
            );
          })}
          <a
            href={contact}
            className="btn-liquid-dark ms-2 flex h-11 items-center rounded-full px-4.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Früher Zugang
          </a>
        </nav>
      </div>
    </header>
  );
}
