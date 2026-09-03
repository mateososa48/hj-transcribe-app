import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

import { BrandWave } from '@/components/brand-wave';
import { cn } from '@/lib/utils';
import type { Lang } from './copy';
import { useLang } from './i18n';

/**
 * The header.
 *
 * Resting on the hero it is a transparent row on the page's own grid: the
 * language switch and the wordmark on the content's left edge, the key on its
 * right edge. Once the page moves it gathers into a narrower pill of white
 * glass and stays on screen. The mark is painted on a transparent canvas, so
 * it never carries a white ground onto whatever is behind the header. One
 * highlight slides between the section links, following the pointer, and
 * otherwise rests on the section that crosses the middle of the viewport.
 *
 * The key sits concentric with the pill in both states: its inset from the
 * pill's right edge equals its inset from the top and bottom.
 */

const SECTIONS = ['werkzeuge', 'vorlagen'] as const;
const LANGS: Lang[] = ['de', 'en'];

export function Nav({ contact }: { contact: string }) {
  const reduce = useReducedMotion();
  const { lang, copy, setLang } = useLang();
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
          // the switch and the key sit on the hero's own text edges. Once
          // moving it gathers into a narrower pill: height 64 → 56, key 44,
          // so the key's inset from the pill's right edge (padding + 1px
          // border) equals its inset from the top and bottom: 6px.
          'mx-auto flex items-center gap-1 rounded-full border transition-[max-width,width,height,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          scrolled
            ? 'h-14 w-[calc(100%-2rem)] max-w-[52rem] ps-[calc(0.375rem-1px)] pe-[calc(0.375rem-1px)]'
            : 'h-16 w-full max-w-6xl border-transparent bg-transparent px-[calc(1.5rem-1px)]',
          scrolled && (dark ? 'nav-glass-dark border-white/10 text-white' : 'nav-glass border-white/80'),
        )}
      >
        {/* The language switch: two labels, one thumb that slides between them. */}
        <div
          role="group"
          aria-label={copy.nav.language}
          data-lang-toggle
          className={cn(
            'flex h-8 shrink-0 items-center rounded-full p-0.5 transition-[background-color,box-shadow] duration-300 sm:h-9 sm:p-1',
            dark
              ? 'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(255,255,255,0.1)]'
              : 'bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_0_0_1px_rgba(12,12,13,0.08)]',
          )}
        >
          {LANGS.map((l) => {
            const on = l === lang;
            return (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={on}
                onClick={() => setLang(l)}
                className={cn(
                  'relative h-7 cursor-pointer rounded-full px-2 text-xs font-semibold tracking-wide uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-2.5',
                  on
                    ? dark
                      ? 'text-foreground'
                      : 'text-white'
                    : dark
                      ? 'text-white/60 hover:text-white'
                      : 'text-foreground/60 hover:text-foreground',
                )}
              >
                {on ? (
                  <motion.span
                    layoutId="lang-thumb"
                    aria-hidden
                    className={cn('absolute inset-0 rounded-full', dark ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]' : 'btn-liquid-dark')}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
                  />
                ) : null}
                <span className="relative">{l}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          aria-label={copy.nav.toTop}
          className="ms-2 flex cursor-pointer items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:ms-3"
        >
          <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap transition-colors duration-300 sm:text-[1.05rem]">Arzt-Assistent</span>
          <BrandWave transparent dark={dark} className="hidden h-10 w-12 shrink-0 sm:block" />
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
                  'relative hidden rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:block',
                  lit ? (dark ? 'text-white' : 'text-foreground') : dark ? 'text-white/60' : 'text-muted-foreground',
                )}
              >
                {lit ? (
                  <motion.span
                    layoutId="nav-highlight"
                    aria-hidden
                    className={cn('absolute inset-0 rounded-full', dark ? 'bg-white/12' : 'bg-white/70 shadow-[0_0_0_1px_rgba(12,12,13,0.05)]')}
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
              'ms-2 flex h-11 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4.5',
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
