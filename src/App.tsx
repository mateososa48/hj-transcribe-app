import { useEffect } from 'react';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { HomeScreen } from '@/features/home/HomeScreen';
import { RecordScreen } from '@/features/record/RecordScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useAppStore } from '@/store/app-store';
import { useSettingsStore } from '@/store/settings-store';

/**
 * One column, one screen at a time.
 *
 * The three-layout comparison is gone: with two features and a linear path
 * through them there is nothing left for a sidebar to hold, and a layout
 * switcher was one more control that could put him somewhere he did not mean
 * to be.
 */
export default function App() {
  const { view, sessionId, kind, goHome, startRecording, openResult, openSettings } = useAppStore();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 sm:px-8">
        <button
          type="button"
          onClick={goHome}
          className="rounded-md text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Arztbrief-Assistent
        </button>
        <Button
          variant="ghost"
          size="lg"
          onClick={openSettings}
          aria-label="Einstellungen"
          className="text-muted-foreground"
        >
          <Settings2 aria-hidden />
          <span className="hidden sm:inline">Einstellungen</span>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10 sm:px-8">
        {!loaded ? (
          <p className="text-muted-foreground">Wird geladen …</p>
        ) : view === 'start' ? (
          <HomeScreen onStart={startRecording} onOpen={openResult} />
        ) : view === 'aufnahme' ? (
          <RecordScreen
            kind={kind}
            onBack={goHome}
            onFinished={(id) => openResult(id, kind)}
          />
        ) : view === 'ergebnis' ? (
          <ResultScreen sessionId={sessionId} kind={kind} onBack={goHome} />
        ) : (
          <SettingsPage onBack={goHome} />
        )}
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
