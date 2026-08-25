import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StartScreen } from '@/features/start/StartScreen';
import { RecentList } from './pieces';
import { useAppStore } from '@/store/app-store';

/**
 * Experiment "Blatt": the narrowest possible app — one sheet of paper. No
 * sidebar, no tabs anywhere: a recording is a single continuous document
 * (notes, then transcript, then nothing else), read top to bottom the way he
 * reads a letter. The bet: tabs hide the transcript, and hiding the ground
 * truth is the one thing this product must never do.
 */
export function BlattLayout() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const openSettings = useAppStore((s) => s.openSettings);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={goHome}
          className="rounded-md text-sm font-semibold tracking-widest text-muted-foreground uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Arztbrief-Assistent
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={openSettings}
          aria-label="Einstellungen"
          className="absolute right-4 text-muted-foreground"
        >
          <Settings2 aria-hidden />
        </Button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-4 pb-16">
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
          <SessionView sessionId={view.sessionId} body="paper" />
        ) : (
          <SettingsPage />
        )}
      </main>
    </div>
  );
}
