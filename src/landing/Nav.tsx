import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import { useLang } from './i18n';

/**
 * The header.
 *
 * Resting on the hero it is a transparent row on the page's own grid: the
 * wordmark on the content's left edge, the key on its right edge. Once the page moves it gathers into a narrower pill of white
 * glass and stays on screen. The mark is painted on a transparent canvas, so
 * it never carries a white ground onto whatever is behind the header. One
 * highlight slides between the section links, following the pointer, and
 * otherwise rests on the section that crosses the middle of the viewport.
 *
 * The key sits concentric with the pill in both states: its inset from the
 * pill's right edge equals its inset from the top and bottom.
 */

const SECTIONS = ['werkzeuge', 'vorlagen'] as const;

export function Nav({ contact }: { contact: string }) {
  const reduce = useReducedMotion();
  const { copy } = useLang();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  // Whether the dark slab is behind the header: the pill turns to dark glass.
  const [onDark, setOnDark] = useState(false);
  const { scrollY } = useScroll();
  const slabRef = useRef<HTMLElement | null>(null);
  // Dark when the slab's surface is behind the pill's centre line (44px down).
  const readDark = () => {
    const slab = (slabRef.current ??= document.querySelector<HTMLElement>('#werkzeuge .slab-dark'));
    if (!slab) return false;
    const r = slab.getBoundingClientRect();
    return r.top < 44 && r.bottom > 44;
  };
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 24);
    setOnDark(readDark());
  });

  const items = [
    { id: 'werkzeuge', label: copy.nav.tools },
    { id: 'vorlagen', label: copy.nav.templates },
  ];

  // Which section crosses the middle of the viewport.
  useEffect(() => {
    const els = SECTIONS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
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
    setOnDark(readDark());
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dark = scrolled && onDark;

  return (
    <header className="fixed inset-x-0 top-3 z-50 sm:top-4">
      <div
        className={cn(
          // At rest the row is the content column itself (max-w-6xl, px-6), so
          // the wordmark and the key sit on the hero's own text edges. Once
          // moving it gathers into a narrower pill: height 64 → 56, key 44,
          // so the key's inset from the pill's right edge (padding + 1px
          // border) equals its inset from the top and bottom: 6px.
          'relative isolate mx-auto flex items-center gap-1 rounded-full border transition-[max-width,width,height,background-color,border-color,box-shadow,padding,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          scrolled
            ? 'nav-glass h-14 w-[calc(100%-2rem)] max-w-[52rem] ps-5 pe-[calc(0.375rem-1px)]'
            : 'h-16 w-full max-w-6xl border-transparent bg-transparent px-[calc(1.5rem-1px)]',
          scrolled && (dark ? 'border-white/10 text-white' : 'border-white/80'),
        )}
      >
        {/* The dark surface, fading in over the glass while the slab is behind. */}
        <span
          aria-hidden
          className={cn(
            'nav-glass-dark-layer pointer-events-none absolute inset-0 -z-10 rounded-full transition-opacity duration-500 ease-out motion-reduce:transition-none',
            dark ? 'opacity-100' : 'opacity-0',
          )}
        />
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          aria-label={copy.nav.toTop}
          className="flex cursor-pointer items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap transition-colors duration-500 sm:text-[1.05rem]">Arzt-Assistent</span>
          <BrandWave transparent dark={dark} className="h-10 w-12 shrink-0" />
        </button>

        <nav aria-label={copy.nav.sections} onMouseLeave={() => setHover(null)} className="ms-auto flex items-center gap-0.5">
          {items.map((it) => {
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
                  'relative hidden rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:block',
                  lit ? (dark ? 'text-white' : 'text-foreground') : dark ? 'text-white/60' : 'text-muted-foreground',
                )}
              >
                {lit ? (
                  <motion.span
                    layoutId="nav-highlight"
                    aria-hidden
                    className={cn('absolute inset-0 rounded-full transition-[background-color,box-shadow] duration-500', dark ? 'bg-white/12' : 'bg-white/70 shadow-[0_0_0_1px_rgba(12,12,13,0.05)]')}
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
              'ms-2 flex h-11 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4.5',
              dark ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:bg-white/90' : 'btn-liquid-dark text-white',
            )}
          >
            {copy.nav.cta}
          </a>
        </nav>
      </div>
    </header>
  );
}
