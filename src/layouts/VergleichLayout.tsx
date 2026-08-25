import { CalendarPlus, Home, Mic, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StartScreen } from '@/features/start/StartScreen';
import { RecentList } from './pieces';
import { cn } from '@/lib/utils';
import { useAppStore, type View } from '@/store/app-store';

/**
 * Experiment "Vergleich": built around the checking moment. A recording opens
 * with the notes on the left and the transcript on the right — reading a
 * number in the notes and finding it in the ground truth without a single
 * click. Navigation shrinks to an icon rail to buy the width that makes two
 * real columns possible. The bet: checking IS the job; everything else is
 * secondary to putting evidence beside claim.
 */
export function VergleichLayout() {
  const view = useAppStore((s) => s.view);
  const goHome = useAppStore((s) => s.goHome);
  const startRecording = useAppStore((s) => s.startRecording);
  const openSettings = useAppStore((s) => s.openSettings);

  const railButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active: boolean,
  ) => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="icon-lg"
            onClick={onClick}
            aria-label={label}
            className={cn('text-muted-foreground', active && 'text-foreground')}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );

  const isView = (name: View['name']) => view.name === name;

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-sidebar py-4">
        {railButton('Übersicht', <Home aria-hidden />, goHome, isView('start'))}
        <div className="my-2 h-px w-8 bg-border" />
        {railButton('Termin aufnehmen', <CalendarPlus aria-hidden />, () => startRecording('gespraech'), false)}
        {railButton('Diktat starten', <Mic aria-hidden />, () => startRecording('beurteilung'), false)}
        <div className="flex-1" />
        {railButton('Einstellungen', <Settings2 aria-hidden />, openSettings, isView('settings'))}
      </aside>

      <main className="min-w-0 flex-1">
        <div
          className={cn(
            'mx-auto w-full px-6 py-10 sm:px-10',
            view.name === 'session' ? 'max-w-7xl' : 'max-w-3xl',
          )}
        >
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
            <SessionView sessionId={view.sessionId} body="split" />
          ) : (
            <SettingsPage />
          )}
        </div>
      </main>
    </div>
  );
}
