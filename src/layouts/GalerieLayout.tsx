import { ArrowLeft, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { CtaButtons, SessionCards } from './pieces';
import { useAppStore } from '@/store/app-store';

/**
 * Experiment "Galerie": the desk. Home is everything at once — actions on top,
 * every recording as a card underneath, like documents spread on a table. A
 * recording opens as its own quiet page with one way back. The bet: he thinks
 * in patients, not in navigation, and a card per patient visit is the most
 * literal picture of that.
 */
export function GalerieLayout() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const openSettings = useAppStore((s) => s.openSettings);

  if (view.name === 'start') {
    return (
      <div className="min-h-svh bg-background">
        <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-end justify-between gap-6 pb-10">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Arztbrief-Assistent</h1>
              <p className="text-lg text-muted-foreground">
                Alles bleibt auf diesem Computer — kein Server, kein Konto.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CtaButtons />
              <Button variant="ghost" onClick={openSettings} aria-label="Einstellungen" className="text-muted-foreground">
                <Settings2 aria-hidden />
              </Button>
            </div>
          </div>
          <SessionCards />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
        <div className="mb-8">
          <Button variant="ghost" onClick={goHome}>
            <ArrowLeft aria-hidden />
            Zum Schreibtisch
          </Button>
        </div>
        {view.name === 'record' ? (
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
