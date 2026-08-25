import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StartScreen } from '@/features/start/StartScreen';
import { RecentList } from './pieces';
import { useAppStore } from '@/store/app-store';

/**
 * Experiment "Leiste": no sidebar at all. A slim top bar carries the brand and
 * settings; everything else is one calm reading column, and the history lives
 * where the day starts — on the start page, under the two actions. The bet:
 * HJ opens one recording at a time, so permanent navigation is chrome he pays
 * for and never uses.
 */
export function LeisteLayout() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const openSettings = useAppStore((s) => s.openSettings);

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
        <Button variant="ghost" onClick={openSettings} aria-label="Einstellungen" className="text-muted-foreground">
          <Settings2 aria-hidden />
          <span className="hidden sm:inline">Einstellungen</span>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-8">
        {view.name === 'start' ? (
          <div className="space-y-12">
            <StartScreen />
            <section className="space-y-3">
              <h2 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Zuletzt
              </h2>
              <RecentList limit={10} />
            </section>
          </div>
        ) : view.name === 'record' ? (
          <RecordFlow kind={view.kind} />
        ) : view.name === 'session' ? (
          <SessionView sessionId={view.sessionId} />
        ) : (
          <SettingsPage />
        )}
      </main>
    </div>
  );
}
