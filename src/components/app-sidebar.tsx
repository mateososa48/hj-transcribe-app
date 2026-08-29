import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FilePen, FileText, MessagesSquare, Mic, Settings2, Stethoscope } from 'lucide-react';

import { BorderBeam } from 'border-beam';

import { BrandWave } from '@/components/brand-wave';
import { createDocument } from '@/lib/documents';
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
          <BrandWave className="h-11 w-14 shrink-0" />
        </button>
        <div className="flex flex-col gap-2">
          <SidebarAction icon={Stethoscope} label="Termin aufnehmen" onRun={() => go.record('gespraech')} />
          <SidebarAction icon={Mic} label="Diktat starten" onRun={() => go.record('beurteilung')} />
          <SidebarAction icon={FilePen} label="Bericht erstellen" onRun={go.newDocument} />
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
 * The three ways in. One design for all three — they are peers, and dressing
 * one as the important one only makes the other two look like afterthoughts.
 *
 * Plain surfaces, no gloss: a hairline edge, a quiet lift under the cursor,
 * and on press one turn of the ribbon's own light around the border. The
 * action waits out the first arc of that beam, so the press is acknowledged
 * on the key he actually pressed before the screen changes under him.
 */
const BEAM_LEAD_IN = 170;

/**
 * The surface. No border property anywhere: the edge is an inset hairline, a
 * finer light line along the top for the lit face, and one soft shadow to seat
 * it — the beam site's own recipe.
 *
 * It is dark because the beam is LIGHT. A travelling glow has nothing to
 * travel against on a white key; measured on white it reached a saturation of
 * 39 out of 255 and covered a quarter of one percent of the key. Matte, not
 * glossy — the old lacquered black key is not coming back.
 */
const KEY_SURFACE =
  'bg-[oklch(0.19_0.006_285)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_0_rgba(255,255,255,0.10)]';
const KEY_SURFACE_HOVER =
  'hover:bg-[oklch(0.235_0.006_285)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_0_rgba(255,255,255,0.14)]';
const KEY_SURFACE_ACTIVE =
  'active:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10),inset_0_1px_3px_rgba(0,0,0,0.5)]';

function SidebarAction({
  icon: Icon,
  label,
  onRun,
}: {
  icon: typeof Mic;
  label: string;
  onRun: () => void;
}) {
  const [beaming, setBeaming] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <BorderBeam
      size="md"
      theme="dark"
      colorVariant="colorful"
      active={beaming}
      borderRadius={12}
      duration={1.15}
      brightness={1.9}
      saturation={2.0}
      className="block w-full"
    >
      <button
        type="button"
        onClick={() => {
          setBeaming(true);
          timers.current.push(setTimeout(onRun, BEAM_LEAD_IN));
          timers.current.push(setTimeout(() => setBeaming(false), 1100));
        }}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium tracking-[-0.01em]',
          'transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'hover:-translate-y-px active:translate-y-0',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          KEY_SURFACE,
          KEY_SURFACE_HOVER,
          KEY_SURFACE_ACTIVE,
        )}
      >
        <Icon aria-hidden className="size-[18px] shrink-0 text-white/55" />
        {label}
      </button>
    </BorderBeam>
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
