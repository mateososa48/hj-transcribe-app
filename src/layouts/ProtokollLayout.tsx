import { ChevronDown, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SessionView } from '@/features/session/SessionView';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SettingsPage } from '@/features/settings/SettingsPage';
import {
  sessionSubtitle,
  sessionTimeTitle,
  useSessions,
} from '@/features/sessions/useSessions';
import { SESSION_KIND_LABELS } from '@/lib/db';
import { CtaButtons, KindIcon } from './pieces';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * Experiment "Protokoll": the practice journal. One chronological feed,
 * grouped by day; a recording expands IN PLACE instead of navigating away, so
 * the day always stays in view around it. The bet: his mental model is "what
 * happened today", and never leaving the timeline is calmer than pages.
 */
export function ProtokollLayout() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const openSession = useAppStore((s) => s.openSession);
  const openSettings = useAppStore((s) => s.openSettings);
  const { sessions } = useSessions(200);

  const expandedId = view.name === 'session' ? view.sessionId : null;

  // Group by calendar day, newest first.
  const groups = new Map<string, typeof sessions>();
  for (const item of sessions) {
    const key = new Date(item.session.startedAt).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur sm:px-8">
        <button
          type="button"
          onClick={goHome}
          className="rounded-md text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Arztbrief-Assistent
        </button>
        <div className="flex items-center gap-2">
          <CtaButtons />
          <Button variant="ghost" size="icon" onClick={openSettings} aria-label="Einstellungen" className="text-muted-foreground">
            <Settings2 aria-hidden />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-8">
        {view.name === 'record' ? (
          <RecordFlow kind={view.kind} />
        ) : view.name === 'settings' ? (
          <SettingsPage />
        ) : sessions.length === 0 ? (
          <p className="py-10 text-center text-lg text-muted-foreground">
            Noch keine Aufnahmen. Beginnen Sie oben mit einem Termin oder einem Diktat.
          </p>
        ) : (
          <div className="space-y-10">
            {[...groups.entries()].map(([day, items]) => (
              <section key={day} className="space-y-2">
                <h2 className="px-1 text-sm font-medium text-muted-foreground">{day}</h2>
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const { session } = item;
                    const open = session.id === expandedId;
                    return (
                      <article
                        key={session.id}
                        className={cn(
                          'rounded-xl border transition-colors',
                          open ? 'border-border bg-card' : 'border-transparent',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => (open ? goHome() : openSession(session.id))}
                          aria-expanded={open}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                            'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            open && 'hover:bg-transparent',
                          )}
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                            <KindIcon kind={session.kind} className="size-4.5" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{sessionTimeTitle(session)}</span>
                            {!open ? (
                              <span className="truncate text-sm text-muted-foreground">
                                {sessionSubtitle(item)}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {SESSION_KIND_LABELS[session.kind]}
                          </span>
                          <ChevronDown
                            className={cn(
                              'size-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none',
                              open && 'rotate-180',
                            )}
                            aria-hidden
                          />
                        </button>
                        {open ? (
                          <div className="border-t border-border px-5 py-6 sm:px-6">
                            <SessionView sessionId={session.id} body="paper" />
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
