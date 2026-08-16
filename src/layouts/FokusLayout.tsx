import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { BRAND, LayoutSwitcher, NAV } from './shared';

/**
 * Layout A — "Fokus".
 *
 * One task per screen, centred, with the largest possible targets. Nothing on
 * screen that is not part of the task in hand.
 *
 * The argument for it: the user is 75 and not a fluent computer user. Every
 * additional region on screen is another thing to scan past. A single column
 * means there is only ever one place to look, and the record button can be
 * enormous without competing with anything.
 *
 * The argument against: no sense of continuity. He cannot see that yesterday's
 * letter is still unapproved without navigating to it.
 */
export function FokusLayout({ children }: { children: ReactNode }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-6 px-6">
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-end px-6">
          <LayoutSwitcher />
        </div>
      </footer>
    </div>
  );
}
