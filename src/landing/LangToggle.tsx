import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';
import type { Lang } from './copy';
import { useLang } from './i18n';

/**
 * The language switch: a small pill fixed in the bottom-left corner, two
 * labels and one dark thumb that slides between them. Solid white, so it
 * reads the same over the hero, the dark slab and the closing field.
 */

const LANGS: Lang[] = ['de', 'en'];

export function LangToggle() {
  const reduce = useReducedMotion();
  const { lang, copy, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label={copy.nav.language}
      data-lang-toggle
      className="fixed bottom-4 left-4 z-50 flex h-7 items-center rounded-full bg-white p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_0_0_1px_rgba(12,12,13,0.08),0_1px_2px_rgba(12,12,13,0.06),0_10px_24px_-10px_rgba(12,12,13,0.3)]"
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
              'relative h-6 cursor-pointer rounded-full px-2 text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              on ? 'text-white' : 'text-foreground/55 hover:text-foreground',
            )}
          >
            {on ? (
              <motion.span
                layoutId="lang-thumb"
                aria-hidden
                className="btn-liquid-dark absolute inset-0 rounded-full"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
              />
            ) : null}
            <span className="relative">{l}</span>
          </button>
        );
      })}
    </div>
  );
}
