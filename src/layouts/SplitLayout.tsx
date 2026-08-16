import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { BRAND, LayoutSwitcher, NAV } from './shared';

/**
 * Layout C — "Gegenüberstellung".
 *
 * The same familiar top bar, but the review screen becomes two panes: what he
 * dictated on the left, the draft on the right.
 *
 * The argument for it: the hard part of this product is not producing a draft,
 * it is checking one. He has to satisfy himself that every value and every
 * negation in the letter actually came from what he said — and that is a
 * comparison task. Putting source and draft side by side is the difference
 * between checking and remembering.
 *
 * The argument against: two columns of dense German is more on screen at once
 * than either other layout, and it only helps on the review step.
 */
export function SplitLayout({ children, wide }: { children: ReactNode; wide: boolean }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border">
        <div
          className={cn(
            'mx-auto flex h-16 items-center justify-between gap-6 px-6',
            wide ? 'max-w-[110rem]' : 'max-w-3xl',
          )}
        >
          <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
          <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = view === id;
              return (
                <Button
                  key={id}
                  size="lg"
                  variant={active ? 'secondary' : 'ghost'}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setView(id)}
                  className={cn('px-4', active && 'font-semibold')}
                >
                  <Icon aria-hidden />
                  {label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* The review screen owns the full height so the two panes can scroll
          independently; every other screen keeps the narrow reading column. */}
      {wide ? (
        <main className="min-h-0 flex-1">{children}</main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-10">{children}</div>
        </main>
      )}

      <footer className="shrink-0 border-t border-border">
        <div
          className={cn(
            'mx-auto flex h-12 items-center justify-end px-6',
            wide ? 'max-w-[110rem]' : 'max-w-3xl',
          )}
        >
          <LayoutSwitcher />
        </div>
      </footer>
    </div>
  );
}
