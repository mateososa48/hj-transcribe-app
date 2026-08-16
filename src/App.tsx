import { useEffect } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { LetterView } from '@/features/letter/LetterView';
import { SplitLetterView } from '@/features/letter/SplitLetterView';
import { RecordScreen } from '@/features/record/RecordScreen';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { FokusLayout } from '@/layouts/FokusLayout';
import { SplitLayout } from '@/layouts/SplitLayout';
import { WerkbankLayout } from '@/layouts/WerkbankLayout';
import { db } from '@/lib/db';
import { useAppStore } from '@/store/app-store';
import { useSettingsStore } from '@/store/settings-store';

export default function App() {
  const { view, sessionId, layout, setView, setSessionId } = useAppStore();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Pick up the most recent finished session on launch so a reload never
  // strands a draft he was in the middle of reviewing.
  useEffect(() => {
    void db.sessions
      .where('status')
      .equals('stopped')
      .last()
      .then((s) => {
        if (s) setSessionId(useAppStore.getState().sessionId ?? s.id);
      });
  }, [setSessionId]);

  const openSettings = () => setView('einstellungen');

  // The review screen is the only one that wants the full width, and only in
  // the split layout.
  const wantsWide = layout === 'split' && view === 'brief';

  const content = !loaded ? (
    <p className="text-muted-foreground">Wird geladen …</p>
  ) : view === 'aufnahme' ? (
    // flex-1 rather than a viewport calc: each layout has different chrome, and
    // a magic number tuned for one of them mis-centres in the others.
    <div className="grid flex-1 place-items-center py-4">
      <RecordScreen
        onOpenSettings={openSettings}
        onSessionReady={(id) => {
          setSessionId(id);
          setView('brief');
        }}
      />
    </div>
  ) : view === 'brief' ? (
    layout === 'split' ? (
      <SplitLetterView sessionId={sessionId} onOpenSettings={openSettings} />
    ) : (
      <LetterView sessionId={sessionId} onOpenSettings={openSettings} />
    )
  ) : (
    <SettingsPage />
  );

  return (
    <>
      {layout === 'werkbank' ? (
        <WerkbankLayout>{content}</WerkbankLayout>
      ) : layout === 'split' ? (
        <SplitLayout wide={wantsWide}>{content}</SplitLayout>
      ) : (
        <FokusLayout>{content}</FokusLayout>
      )}
      <Toaster position="bottom-right" />
    </>
  );
}
