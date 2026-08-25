import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StartScreen } from '@/features/start/StartScreen';
import { useAppStore } from '@/store/app-store';

/**
 * The shipped arrangement: grouped sidebar, one column of content.
 *
 * The column width adapts to the view. A finished session wants nearly the
 * whole area (a letter plus its evidence, not a strip in a sea of margin);
 * the start screen, recorder and settings are single-purpose surfaces that
 * would only dilute at full width.
 */
const MAIN_WIDTHS: Record<string, string> = {
  start: 'max-w-5xl',
  record: 'max-w-4xl',
  session: 'max-w-[100rem]',
  settings: 'max-w-4xl',
};

export function StandardLayout() {
  const view = useAppStore((s) => s.view);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-base font-semibold tracking-tight">Arztbrief-Assistent</span>
        </header>
        <main className={`mx-auto w-full flex-1 px-6 py-8 sm:px-10 xl:px-14 ${MAIN_WIDTHS[view.name]}`}>
          {view.name === 'start' ? (
            <StartScreen />
          ) : view.name === 'record' ? (
            <RecordFlow kind={view.kind} />
          ) : view.name === 'session' ? (
            <SessionView sessionId={view.sessionId} />
          ) : (
            <SettingsPage />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
