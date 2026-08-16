import { useEffect, useState } from 'react';
import { FileText, Mic, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { LetterView } from '@/features/letter/LetterView';
import { RecordScreen } from '@/features/record/RecordScreen';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { db } from '@/lib/db';
import { useSettingsStore } from '@/store/settings-store';
import { cn } from '@/lib/utils';

type View = 'aufnahme' | 'brief' | 'einstellungen';

const NAV: Array<{ id: View; label: string; icon: typeof Mic }> = [
  { id: 'aufnahme', label: 'Aufnahme', icon: Mic },
  { id: 'brief', label: 'Brief', icon: FileText },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings2 },
];

export default function App() {
  const [view, setView] = useState<View>('aufnahme');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Pick up the most recent finished session on launch, so a reload does not
  // strand a draft he was in the middle of reviewing.
  useEffect(() => {
    void db.sessions
      .where('status')
      .equals('stopped')
      .last()
      .then((s) => setSessionId((current) => current ?? s?.id ?? null));
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-6 px-6">
          <span className="text-lg font-semibold tracking-tight">Arztbrief-Assistent</span>

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

      <main className="mx-auto max-w-3xl px-6 py-10">
        {!loaded ? (
          <p className="text-muted-foreground">Wird geladen …</p>
        ) : view === 'aufnahme' ? (
          <div className="grid min-h-[calc(100svh-4rem-5rem)] place-items-center">
            <RecordScreen
              onOpenSettings={() => setView('einstellungen')}
              onSessionReady={(id) => {
                setSessionId(id);
                setView('brief');
              }}
            />
          </div>
        ) : view === 'brief' ? (
          <LetterView sessionId={sessionId} onOpenSettings={() => setView('einstellungen')} />
        ) : (
          <SettingsPage />
        )}
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
