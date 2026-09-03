import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';

import { applyPagePushes, collectAtoms, type PagePush } from './pagination';
import { TranslationShader } from './TranslationShader';

/**
 * The sheet on the desk.
 *
 * A Bericht is a Word document in his hands, so it must look like one: a page
 * with real proportions (DIN A4, the paper his letters print on), never a
 * half-height card that stops where the text happens to stop. It is ALWAYS at
 * least one full page; when the writing outgrows the paper the sheet grows by
 * a whole page at a time and the break is drawn where it falls.
 *
 * Nothing is ever cut in half by a page edge: a block that would straddle one
 * is pushed whole onto the next page (see ./pagination.ts), so the rule always
 * falls in white space, the way it does in Word.
 */
const A4_RATIO = 1.4142; // height ÷ width

export function PagedSheet({
  editor,
  busy = false,
  children,
}: {
  /** Measured on every edit — a sheet must lose a page as readily as gain one. */
  editor: Editor | null;
  /** Something is being made from this letter: the sheet carries the light. */
  busy?: boolean;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  /** Whether page pushes are currently applied, so we clear only when needed. */
  const pushedRef = useRef(false);
  const [pageHeight, setPageHeight] = useState(0);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const measure = () => {
      const view = editor?.view;
      if (!view || view.isDestroyed) return;

      // Clear the previous pass's pushes before reading, so every position we
      // measure is the block's natural one. ProseMirror applies this
      // synchronously, so the browser only ever paints the finished result —
      // and we only spend the transaction when there is something to clear.
      if (pushedRef.current) {
        applyPagePushes(editor, []);
        pushedRef.current = false;
      }

      const rect = sheet.getBoundingClientRect();
      if (!rect.width) return;
      const height = rect.width * A4_RATIO;
      const style = getComputedStyle(sheet);
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const usable = height - padTop - padBottom;

      // Read every block's natural geometry in one batch, then write the
      // corrections in a second — never interleaved, which would force a
      // reflow per paragraph.
      const natural = collectAtoms(view).map((atom) => {
        const box = atom.dom.getBoundingClientRect();
        return { pos: atom.pos, top: box.top - rect.top, height: box.height };
      });
      const flow = sheet.querySelector('.tiptap');
      const lastBottom = flow?.lastElementChild?.getBoundingClientRect().bottom ?? rect.bottom;

      // A paragraph must not be sliced by a page edge. Any block that would
      // straddle one is pushed whole onto the next page — the bargain Word
      // makes, and the reason its pages read as pages.
      const pushes: PagePush[] = [];
      let shift = 0;
      for (const item of natural) {
        const top = item.top + shift;
        const page = Math.floor(top / height);
        const bottomOfPage = (page + 1) * height - padBottom;
        // A block taller than a whole page has nowhere to go; let it run on.
        if (top + item.height > bottomOfPage + 1 && item.height <= usable) {
          const push = (page + 1) * height + padTop - top;
          pushes.push({ pos: item.pos, px: Math.round(push) });
          shift += push;
        }
      }
      if (pushes.length) {
        applyPagePushes(editor, pushes);
        pushedRef.current = true;
      }

      // How far the writing actually reaches — measured from the last block,
      // not from the box, which is stretched to fill the page.
      const extent = lastBottom - rect.top + shift + padBottom;

      setPageHeight(height);
      // A hair of tolerance: a page that is exactly full must not conjure a
      // second, empty one.
      setPages(Math.max(1, Math.ceil((extent - 2) / height)));
    };

    // Coalesce to one measurement per frame: a keystroke and a resize in the
    // same tick must not each force layout.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(sheet);

    // The width comes from the box; the page COUNT comes from the writing —
    // and a stretched flex box does not shrink when he deletes a paragraph,
    // so the editor's own updates are the signal, not the box's size.
    editor?.on('update', schedule);
    schedule();
    return () => {
      observer.disconnect();
      editor?.off('update', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [editor]);

  const breaks = pageHeight
    ? Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * pageHeight)
    : [];

  return (
    <div className="flex-1 px-4 py-10 sm:px-8 sm:py-12">
      <div
        ref={sheetRef}
        style={pageHeight ? { minHeight: `${pages * pageHeight}px` } : undefined}
        className="relative mx-auto flex w-full max-w-[52rem] flex-col rounded-[3px] border border-border/80 bg-card px-8 py-10 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-16px_rgba(0,0,0,0.22)] transition-[min-height] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:px-20 sm:py-16"
      >
        {breaks.map((top, i) => (
          <div
            key={top}
            aria-hidden
            style={{ top: `${top}px` }}
            className="pointer-events-none absolute inset-x-0 z-10 select-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          >
            <div className="h-px w-full bg-border" />
            <div className="h-3 w-full bg-gradient-to-b from-foreground/[0.045] to-transparent" />
            <span className="absolute end-4 top-2 text-xs text-muted-foreground/70 tabular-nums">
              Seite {i + 2}
            </span>
          </div>
        ))}
        {children}
        {/* Over the writing, never in place of it: he can keep reading while
            the translation is made. */}
        {busy ? <TranslationShader className="z-20" /> : null}
      </div>
    </div>
  );
}
