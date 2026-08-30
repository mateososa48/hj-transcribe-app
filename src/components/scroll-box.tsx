import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A short scrolling region that says so — and only when it is true.
 *
 * It fades the text under whichever edge it actually continues past, so the
 * hint is information rather than decoration: a transcript that ends where it
 * ends looks like it ends, and one with more below is visibly cut. Pairs with
 * the `scroll-hint` utility, which owns the mask and the slim scrollbar.
 */
export function ScrollBox({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A hair of tolerance: sub-pixel layout must not leave a permanent fade on
    // a box scrolled all the way down.
    const overflowing = el.scrollHeight - el.clientHeight > 1;
    setEdges({
      top: overflowing && el.scrollTop > 1,
      bottom: overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // The content arrives after the transcript loads, and the box itself
    // resizes with the card — both change the answer.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  return (
    <div
      ref={ref}
      className={cn('scroll-hint', className)}
      {...(edges.top ? { 'data-fade-top': '' } : {})}
      {...(edges.bottom ? { 'data-fade-bottom': '' } : {})}
    >
      {children}
    </div>
  );
}
