import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { RecordFlow } from '@/features/record/RecordFlow';
import { ProcessingHandoff } from '@/features/session/ProcessingHandoff';
import {
  getProcessingPreviewPhase,
  type ActiveProcessingPhase,
} from '@/features/session/processing-handoff-model';
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
  const processingPreview = getProcessingPreviewPhase(window.location.search, import.meta.env.DEV);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-base font-semibold tracking-tight">Arztbrief-Assistent</span>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-10">
          {processingPreview ? (
            <ProcessingPreview phase={processingPreview} />
          ) : view.name === 'start' ? (
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

function ProcessingPreview({ phase }: { phase: ActiveProcessingPhase }) {
  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-3">
        <Badge variant="secondary">Termin</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Termin heute, 14:30 Uhr</h1>
        <p className="text-sm text-muted-foreground">Montag, 24. August · 12:30 min</p>
      </div>

      <ProcessingHandoff kind="gespraech" phase={phase} />

      <Tabs defaultValue="notizen">
        <TabsList>
          <TabsTrigger value="notizen">Notizen</TabsTrigger>
          <TabsTrigger value="transkript">Transkript</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
