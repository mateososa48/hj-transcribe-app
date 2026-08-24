import { CalendarPlus, MessagesSquare, Mic, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { dayGroup, sessionTitle, useSessions, type SessionSummary } from '@/features/sessions/useSessions';
import type { SessionKind } from '@/lib/db';
import { useAppStore } from '@/store/app-store';

/**
 * The app's spine: start something new at the top, everything ever recorded
 * below it, grouped by day — the Notion/Granola shape. The list is the
 * navigation; there is no separate "home" entry because selecting nothing IS
 * home.
 */
export function AppSidebar() {
  const view = useAppStore((s) => s.view);
  const startRecording = useAppStore((s) => s.startRecording);
  const openSession = useAppStore((s) => s.openSession);
  const openSettings = useAppStore((s) => s.openSettings);
  const goHome = useAppStore((s) => s.goHome);
  const { sessions, loading } = useSessions();
  const { isMobile, setOpenMobile } = useSidebar();

  /** On mobile the sidebar is a sheet; navigating should close it. */
  const after = <T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      fn(...args);
      if (isMobile) setOpenMobile(false);
    };

  const go = {
    home: after(goHome),
    record: after((kind: SessionKind) => startRecording(kind)),
    session: after(openSession),
    settings: after(openSettings),
  };

  const groups = new Map<string, SessionSummary[]>();
  for (const item of sessions) {
    const key = dayGroup(item.session.startedAt);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-4">
        <button
          type="button"
          onClick={go.home}
          className="rounded-md px-1 text-left text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Arztbrief-Assistent
        </button>
        <div className="flex flex-col gap-2">
          <Button size="lg" className="justify-start" onClick={() => go.record('gespraech')}>
            <CalendarPlus aria-hidden />
            Termin aufnehmen
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="justify-start"
            onClick={() => go.record('beurteilung')}
          >
            <Mic aria-hidden />
            Diktat starten
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {loading ? null : sessions.length === 0 ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <p className="px-3 py-2 text-sm text-sidebar-foreground/60">
                Noch keine Aufnahmen.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          [...groups.entries()].map(([label, items]) => (
            <SidebarGroup key={label}>
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map(({ session, preview }) => {
                    const active = view.name === 'session' && view.sessionId === session.id;
                    const Icon = session.kind === 'gespraech' ? MessagesSquare : Mic;
                    return (
                      <SidebarMenuItem key={session.id}>
                        <SidebarMenuButton
                          isActive={active}
                          onClick={() => go.session(session.id)}
                          className="h-auto py-2"
                          tooltip={sessionTitle(session)}
                        >
                          <Icon aria-hidden className="text-sidebar-foreground/50" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{sessionTitle(session)}</span>
                            {preview ? (
                              <span className="truncate text-xs text-sidebar-foreground/55">
                                {preview}
                              </span>
                            ) : null}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={view.name === 'settings'}
              onClick={go.settings}
            >
              <Settings2 aria-hidden />
              Einstellungen
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
