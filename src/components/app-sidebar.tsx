import { useState } from 'react';
import { CalendarPlus, ChevronDown, MessagesSquare, Mic, Settings2 } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
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
import {
  sessionSubtitle,
  sessionTimeTitle,
  sessionTitle,
  useSessions,
  type SessionSummary,
} from '@/features/sessions/useSessions';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * The app's spine: start something new at the top, everything ever recorded
 * below it — grouped by WHAT it is (Diktate, Termine), not by when it
 * happened. Five per group; the rest sits behind an animated "Alle anzeigen".
 *
 * Row anatomy: the title is the time (the group heading already says what it
 * is), the subtitle says what came out of it. For a Diktat that is almost
 * always the same thing — a Zusammenfassende Beurteilung — and naming it
 * beats previewing prose that all starts with "Bezüglich der …".
 */

const VISIBLE_LIMIT = 5;

const GROUPS: Array<{ kind: SessionKind; label: string; icon: typeof Mic }> = [
  { kind: 'beurteilung', label: 'Diktate', icon: Mic },
  { kind: 'gespraech', label: 'Termine', icon: MessagesSquare },
];

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

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-4">
        <button
          type="button"
          onClick={go.home}
          className="flex items-center gap-2 rounded-md px-1 text-left text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Arztbrief-Assistent
          <BrandWave className="h-9 w-11 shrink-0" />
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
              <p className="px-3 py-2 text-sm text-sidebar-foreground/60">Noch keine Aufnahmen.</p>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          GROUPS.map((group) => (
            <KindGroup
              key={group.kind}
              label={group.label}
              icon={group.icon}
              items={sessions.filter((s) => s.session.kind === group.kind)}
              activeId={view.name === 'session' ? view.sessionId : null}
              onOpen={go.session}
            />
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={view.name === 'settings'} onClick={go.settings}>
              <Settings2 aria-hidden />
              Einstellungen
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function KindGroup({
  label,
  icon: Icon,
  items,
  activeId,
  onOpen,
}: {
  label: string;
  icon: typeof Mic;
  items: SessionSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visible = items.slice(0, VISIBLE_LIMIT);
  const overflow = items.slice(VISIBLE_LIMIT);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="justify-between pr-2">
        {label}
        <span className="tabular-nums text-sidebar-foreground/40">{items.length}</span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => (
            <Row key={item.session.id} item={item} icon={Icon} activeId={activeId} onOpen={onOpen} />
          ))}
        </SidebarMenu>

        {overflow.length > 0 ? (
          <>
            {/* Animated reveal: grid-rows 0fr -> 1fr, the modern height-auto
                transition. Instant under prefers-reduced-motion. */}
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <SidebarMenu
                  className={cn(
                    'transition-opacity duration-300 motion-reduce:transition-none',
                    expanded ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {overflow.map((item) => (
                    <Row
                      key={item.session.id}
                      item={item}
                      icon={Icon}
                      activeId={activeId}
                      onOpen={onOpen}
                      tabbable={expanded}
                    />
                  ))}
                </SidebarMenu>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={cn(
                'mt-0.5 flex h-8 w-full items-center gap-2 rounded-md px-3 text-sm text-sidebar-foreground/60',
                'transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-300 motion-reduce:transition-none',
                  expanded && 'rotate-180',
                )}
                aria-hidden
              />
              {expanded ? 'Weniger anzeigen' : `Alle ${items.length} anzeigen`}
            </button>
          </>
        ) : null}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function Row({
  item,
  icon: Icon,
  activeId,
  onOpen,
  tabbable = true,
}: {
  item: SessionSummary;
  icon: typeof Mic;
  activeId: string | null;
  onOpen: (id: string) => void;
  tabbable?: boolean;
}) {
  const { session } = item;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={activeId === session.id}
        onClick={() => onOpen(session.id)}
        className="h-auto py-2"
        tooltip={sessionTitle(session)}
        tabIndex={tabbable ? undefined : -1}
      >
        <Icon aria-hidden className="text-sidebar-foreground/50" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{sessionTimeTitle(session)}</span>
          <span className="truncate text-xs text-sidebar-foreground/55">{sessionSubtitle(item)}</span>
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
