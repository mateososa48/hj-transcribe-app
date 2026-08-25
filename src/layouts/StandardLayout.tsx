import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StartScreen } from '@/features/start/StartScreen';
import { useAppStore } from '@/store/app-store';

/** The shipped arrangement: grouped sidebar, one column of content. */
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
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-10">
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
