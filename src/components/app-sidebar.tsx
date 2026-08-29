import { useState } from 'react';
import { ChevronRight, FilePen, FileText, MessagesSquare, Mic, Settings2, Stethoscope } from 'lucide-react';

import { BrandWave } from '@/components/brand-wave';
import { createDocument } from '@/lib/documents';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  relativeDayTime,
  sessionSubtitle,
  sessionTimeTitle,
  sessionTitle,
  useDocuments,
  useSessions,
  type SessionSummary,
} from '@/features/sessions/useSessions';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/**
 * The app's spine: start something new at the top, the whole library below —
 * a small file tree with one node per kind (Diktate, Termine, Berichte).
 * The node IS the collapse: opening it draws the guide line and slides the
 * rows in; there is no separate "Alle anzeigen" anymore.
 *
 * Row anatomy: the title is the time (the node already says what it is),
 * the subtitle says what came out of it.
 */

export function AppSidebar() {
  const view = useAppStore((s) => s.view);
  const startRecording = useAppStore((s) => s.startRecording);
  const openSession = useAppStore((s) => s.openSession);
  const openDocument = useAppStore((s) => s.openDocument);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const openSettings = useAppStore((s) => s.openSettings);
  const goHome = useAppStore((s) => s.goHome);
  const { sessions, loading } = useSessions();
  const { documents } = useDocuments();
  const diktate = sessions.filter((s) => s.session.kind === 'beurteilung');
  const termine = sessions.filter((s) => s.session.kind === 'gespraech');
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
    document: after(openDocument),
    settings: after(openSettings),
    newDocument: after(() => {
      void createDocument().then((doc) => {
        touchSessions();
        openDocument(doc.id);
      });
    }),
  };

  // Only one branch stands open. Three open lists at once is a wall of
  // near-identical rows he has to read through to find anything; opening one
  // closes the last. The branch holding whatever he is looking at starts open.
  const [openNode, setOpenNode] = useState<NodeKey | null>(() =>
    view.name === 'document' ? 'berichte' : 'diktate',
  );
  const nodeProps = (key: NodeKey) => ({
    open: openNode === key,
    onToggle: () => setOpenNode((current) => (current === key ? null : key)),
  });

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
            <Stethoscope aria-hidden />
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
          <Button
            size="lg"
            variant="outline"
            className="justify-start"
            onClick={go.newDocument}
          >
            <FilePen aria-hidden />
            Bericht erstellen
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {loading ? null : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <TreeNode
                  {...nodeProps('diktate')}
                  label="Diktate"
                  icon={Mic}
                  count={diktate.length}
                  emptyText="Noch keine Diktate."
                >
                  {diktate.map((item, i) => (
                    <SessionRow
                      key={item.session.id}
                      item={item}
                      index={i}
                      active={view.name === 'session' && view.sessionId === item.session.id}
                      onOpen={go.session}
                    />
                  ))}
                </TreeNode>

                <TreeNode
                  {...nodeProps('termine')}
                  label="Termine"
                  icon={MessagesSquare}
                  count={termine.length}
                  emptyText="Noch keine Termine."
                >
                  {termine.map((item, i) => (
                    <SessionRow
                      key={item.session.id}
                      item={item}
                      index={i}
                      active={view.name === 'session' && view.sessionId === item.session.id}
                      onOpen={go.session}
                    />
                  ))}
                </TreeNode>

                <TreeNode
                  {...nodeProps('berichte')}
                  label="Berichte"
                  icon={FileText}
                  count={documents.length}
                  emptyText="Noch keine Berichte."
                >
                  {documents.map((doc, i) => (
                    <TreeRow
                      key={doc.id}
                      index={i}
                      title={doc.title}
                      subtitle={`Bearbeitet ${relativeDayTime(doc.updatedAt)}`}
                      active={view.name === 'document' && view.documentId === doc.id}
                      onOpen={() => go.document(doc.id)}
                    />
                  ))}
                </TreeNode>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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

/**
 * One node of the library tree. The house expand pattern (grid-rows 0fr→1fr
 * + opacity, instant under prefers-reduced-motion) with the beui file-tree
 * feel: rotating chevron, guide line (SidebarMenuSub's border), and a small
 * per-row stagger on the way in.
 */
type NodeKey = 'diktate' | 'termine' | 'berichte';

function TreeNode({
  label,
  icon: Icon,
  count,
  emptyText,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: typeof Mic;
  count: number;
  emptyText: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <SidebarMenuItem className="mt-1 first:mt-0">
      <SidebarMenuButton
        onClick={onToggle}
        aria-expanded={open}
        // The branch outranks its contents by WEIGHT first — a hair larger,
        // heavier, full-strength ink — against rows that are lighter and a
        // size down. Any bigger and it stops being a label and starts
        // shouting.
        className="h-10 text-[0.95rem] font-semibold tracking-tight"
      >
        <ChevronRight
          className={cn(
            'size-4 text-sidebar-foreground/50 transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <Icon aria-hidden className="text-sidebar-foreground/70" />
        <span className="flex-1">{label}</span>
        <span className="tabular-nums text-sm font-normal text-sidebar-foreground/45">{count}</span>
      </SidebarMenuButton>

      <div
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <SidebarMenuSub
            className={cn(
              'transition-opacity duration-300 motion-reduce:transition-none',
              open ? 'opacity-100' : 'opacity-0',
            )}
            data-open={open || undefined}
          >
            {count === 0 ? (
              <li className="px-2 py-2 text-sm text-sidebar-foreground/50">{emptyText}</li>
            ) : (
              children
            )}
          </SidebarMenuSub>
        </div>
      </div>
    </SidebarMenuItem>
  );
}

function SessionRow({
  item,
  index,
  active,
  onOpen,
}: {
  item: SessionSummary;
  index: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <TreeRow
      index={index}
      title={sessionTimeTitle(item.session)}
      subtitle={sessionSubtitle(item)}
      tooltip={sessionTitle(item.session)}
      active={active}
      onOpen={() => onOpen(item.session.id)}
    />
  );
}

function TreeRow({
  index,
  title,
  subtitle,
  tooltip,
  active,
  onOpen,
}: {
  index: number;
  title: string;
  subtitle: string;
  tooltip?: string;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <SidebarMenuSubItem
      // The way in: rows fade with a slight stagger; collapse hides parents,
      // so the way out needs no choreography.
      className="transition-opacity duration-200 motion-reduce:transition-none"
      style={{ transitionDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      <SidebarMenuSubButton
        render={<button type="button" />}
        isActive={active}
        onClick={onOpen}
        title={tooltip ?? title}
        className="h-auto w-full py-1.5 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate text-sm text-sidebar-foreground/50">{subtitle}</span>
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
