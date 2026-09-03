import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { COPY, type Copy, type Lang } from './copy';

/**
 * The page's language: German or English, chosen in the header.
 *
 * The choice comes from the URL (?lang=en), then from the last visit, then
 * defaults to German. It is written back to the URL, to storage, to the
 * document's lang attribute, to the title and the description.
 *
 * Switching is a crossfade of the words, not of the page: every text-bearing
 * element fades out over 160ms, the copy swaps while nothing is visible
 * (so the reflow from different word lengths happens unseen), and the new
 * words fade in over 260ms. The backgrounds, the shader fields and the ribbons
 * never blink. Under reduced motion the words simply change.
 */

const STORAGE_KEY = 'arzt-assistent-landing-lang';
const FADE_OUT_MS = 160;
const FADE_IN_MS = 260;
const TEXT_SELECTOR = ':is(main, header nav, footer) :is(h1, h2, h3, p, a, button, dt, dd, li, figcaption, .copy)';

interface LangContextValue {
  lang: Lang;
  copy: Copy;
  setLang: (next: Lang) => void;
  switching: boolean;
}

const LangContext = createContext<LangContextValue | null>(null);

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'de';
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'en' || fromUrl === 'de') return fromUrl;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'de') return stored;
  } catch {
    /* storage may be unavailable; German it is */
  }
  return 'de';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [switching, setSwitching] = useState(false);
  const busy = useRef(false);

  // Mirror the choice everywhere it is read from.
  useEffect(() => {
    const copy = COPY[lang];
    document.documentElement.lang = lang;
    document.title = copy.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.meta.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', copy.meta.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', copy.meta.description);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* fine without */
    }
    const url = new URL(window.location.href);
    if (lang === 'de') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    window.history.replaceState(window.history.state, '', url);
  }, [lang]);

  const setLang = useCallback(
    (next: Lang) => {
      if (next === lang || busy.current) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || typeof Element.prototype.animate !== 'function') {
        setLangState(next);
        return;
      }
      busy.current = true;
      setSwitching(true);
      const out = textElements().map((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT_MS, easing: 'ease-out', fill: 'forwards' }),
      );
      void Promise.all(out.map((a) => a.finished.catch(() => undefined))).then(() => {
        // Swap while nothing is visible; commit synchronously so the fade-in
        // finds the new words already in the DOM.
        flushSync(() => setLangState(next));
        out.forEach((a) => a.cancel());
        const back = textElements().map((el) =>
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS, easing: 'ease-in-out' }),
        );
        void Promise.all(back.map((a) => a.finished.catch(() => undefined))).then(() => {
          busy.current = false;
          setSwitching(false);
        });
      });
    },
    [lang],
  );

  const value = useMemo<LangContextValue>(() => ({ lang, copy: COPY[lang], setLang, switching }), [lang, setLang, switching]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** Every element that carries words, except the language switch itself. */
function textElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TEXT_SELECTOR)).filter((el) => !el.closest('[data-lang-toggle]'));
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang needs a LangProvider');
  return ctx;
}

export function useCopy(): Copy {
  return useLang().copy;
}
