import { ArrowLeft, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSessions } from '@/features/sessions/useSessions';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { CtaButtons, RecordingRow } from './pieces';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * Experiment "Posteingang": the mail-client shape. Every recording in one
 * chronological list on the left — no groups, no truncation — and whatever is
 * selected fills the right. The bet: his day is "work through what came in",
 * and a mail layout is the one structure every computer user his age already
 * knows by heart.
 */
export function PosteingangLayout() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const openSession = useAppStore((s) => s.openSession);
  const openSettings = useAppStore((s) => s.openSettings);
  const { sessions } = useSessions(200);

  const activeId = view.name === 'session' ? view.sessionId : null;
  const detailOpen = view.name !== 'start';

  return (
    <div className="flex min-h-svh bg-background">
      {/* List pane — on small screens it IS the app until something opens. */}
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-border bg-sidebar md:w-[24rem]',
          detailOpen && 'hidden md:flex',
        )}
      >
        <div className="space-y-3 p-4">
          <button
            type="button"
            onClick={goHome}
            className="rounded-md px-1 text-left text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Arztbrief-Assistent
          </button>
          <CtaButtons vertical />
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-0.5 px-2 pb-20">
            {sessions.length === 0 ? (
              <li className="px-3 py-6 text-sm text-muted-foreground">Noch keine Aufnahmen.</li>
            ) : (
              sessions.map((item) => (
                <li key={item.session.id}>
                  <RecordingRow item={item} active={item.session.id === activeId} onOpen={openSession} />
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={openSettings}>
            <Settings2 aria-hidden />
            Einstellungen
          </Button>
        </div>
      </aside>

      <main className={cn('min-w-0 flex-1', !detailOpen && 'hidden md:block')}>
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10">
          {detailOpen ? (
            <div className="mb-6 md:hidden">
              <Button variant="ghost" onClick={goHome}>
                <ArrowLeft aria-hidden />
                Zur Liste
              </Button>
            </div>
          ) : null}
          {view.name === 'record' ? (
            <RecordFlow kind={view.kind} />
          ) : view.name === 'session' ? (
            <SessionView sessionId={view.sessionId} />
          ) : view.name === 'settings' ? (
            <SettingsPage />
          ) : (
            <div className="grid min-h-[60svh] place-items-center">
              <p className="max-w-[40ch] text-center text-lg text-muted-foreground">
                Wählen Sie links eine Aufnahme — oder beginnen Sie eine neue.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
