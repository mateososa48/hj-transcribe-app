import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { RecordFlow } from '@/features/record/RecordFlow';
import { SessionView } from '@/features/session/SessionView';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StartScreen } from '@/features/start/StartScreen';
import { useAppStore } from '@/store/app-store';

/**
 * Sidebar app: everything ever recorded on the left, the selected thing on the
 * right. The Diktat recorder is the one deliberate exception — it takes over
 * the whole screen, because dictating is the one moment nothing else matters.
 */
export default function App() {
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
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}
