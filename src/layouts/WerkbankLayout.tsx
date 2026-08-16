import type { ReactNode } from 'react';
import { Mic, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLetters } from '@/features/letters/useLetters';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { BRAND, LayoutSwitcher, LetterStatusBadge, NAV, formatWhen } from './shared';

/**
 * Layout B — "Werkbank".
 *
 * A persistent sidebar listing every letter and its state, with the active task
 * on the right.
 *
 * The argument for it: a letter is not finished when the recording stops. It
 * has to be drafted, read, corrected and released, and those steps happen at
 * different times of day. This layout makes the backlog impossible to lose —
 * an unapproved draft from this morning is visible while he records the next
 * patient. It also answers "did that save?" without navigating anywhere.
 *
 * The argument against: it puts a list of other patients' letters permanently
 * on screen, which is more to scan and arguably more to worry about.
 */
export function WerkbankLayout({ children }: { children: ReactNode }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const sessionId = useAppStore((s) => s.sessionId);
  const setSessionId = useAppStore((s) => s.setSessionId);
  const { letters } = useLetters();

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="flex w-[19rem] shrink-0 flex-col border-r border-border">
        <div className="flex h-16 items-center px-5">
          <span className="text-base font-semibold tracking-tight">{BRAND}</span>
        </div>

        <nav aria-label="Hauptnavigation" className="flex flex-col gap-1 px-3 pb-3">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <Button
                key={id}
                variant={active ? 'secondary' : 'ghost'}
                size="lg"
                aria-current={active ? 'page' : undefined}
                onClick={() => setView(id)}
                className={cn('h-11 justify-start px-3', active && 'font-semibold')}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Briefe
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSessionId(null);
              setView('aufnahme');
            }}
          >
            <Plus aria-hidden />
            Neu
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-1 px-3 pb-6">
            {letters.length === 0 ? (
              <li className="px-2 py-6 text-sm text-muted-foreground">
                Noch keine Briefe. Beginnen Sie mit einer Aufnahme.
              </li>
            ) : (
              letters.map((letter) => {
                // Only show a row as selected when we are actually looking at
                // that letter. A highlighted row while the record screen is
                // open reads as "this one is open", which it is not.
                const active = view === 'brief' && letter.sessionId === sessionId;
                return (
                  <li key={letter.sessionId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionId(letter.sessionId);
                        setView('brief');
                      }}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors',
                        'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        active && 'border-border bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{formatWhen(letter.startedAt)}</span>
                        <LetterStatusBadge status={letter.status} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {letter.preview ||
                          `${letter.segmentCount} Abschnitt${letter.segmentCount === 1 ? '' : 'e'} aufgenommen`}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </ScrollArea>

        <div className="border-t border-border px-4 py-3">
          <LayoutSwitcher compact />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-8">
          {(() => {
            const entry = NAV.find((n) => n.id === view);
            const Icon = entry?.icon ?? Mic;
            return (
              <>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <h1 className="text-base font-semibold">{entry?.label ?? ''}</h1>
              </>
            );
          })()}
        </header>
        {/* Left-aligned, not centred: with a sidebar already anchoring the left
            edge, a centred column leaves a lopsided gutter and reads as a
            document rather than a workspace. The record screen is the one
            exception — it centres itself. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-10">
          <div className="flex w-full max-w-3xl flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
