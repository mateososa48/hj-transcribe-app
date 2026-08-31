import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FilePen, FileText, MessagesSquare, Mic, Settings2, Stethoscope } from 'lucide-react';

import { BorderBeam } from 'border-beam';

import { BrandWave } from '@/components/brand-wave';
import { createDocument, documentRowTitle } from '@/lib/documents';
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
  compactDayTime,
  sessionRowTitle,
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
      <SidebarHeader className="gap-5 p-4">
        {/* The name, and under it whose desk this is. There is one user and he
            is the only person who will ever read this line; seeing his own
            name is what makes it his instrument rather than software. */}
        <button
          type="button"
          onClick={go.home}
          className="-mx-1 block rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {/* The ribbon rides the NAME line, not the whole block: beside both
              lines it stole 49px from the widest one and cut his own name to
              "Rupprech…". The name line has room to spare; his does not. */}
          {/* The mark rides out to the right gutter rather than trailing the
              name, so it lands on the same edge as everything else in the
              column. */}
          <span className="flex items-center justify-between gap-3">
            {/* Semibold and tracking-tight, the weight every other heading in
                the app carries. One size up from before is all the extra
                presence the name needs; bold made it a different typeface. */}
            <span className="text-[1.375rem] font-semibold tracking-tight whitespace-nowrap">
              Arzt-Assistent
            </span>
            {/* 1.27:1 is the box the ribbon renders ROUND in — at 1.43 it
                flattened to 1.22 wide. And its figure only fills ~70% of the
                box, so the box has to overhang the gutter for the ribbon
                itself to land on it. */}
            <BrandWave className="-my-2.5 -me-1 h-14 w-18 shrink-0" />
          </span>
          {/* Spelled the way he spells it — Jürgen — and abbreviated as it is
              on his letterhead. At 14px, because 12 sat below everything else
              in an app built at 18px root for a 75-year-old's eyes. */}
          <span className="-mt-0.5 block truncate text-[0.83rem] text-sidebar-foreground/60">
            Prof. Hans-Jürgen Rupprecht
          </span>
        </button>

        {/* The three ways in, gathered on their own tray and named. Loose on
            the sidebar they read as three unrelated keys that happen to be
            stacked; inside one surface under one heading they read as the
            answer to a single question. */}
        {/* The same liquid glass the app's light keys wear, held still. */}
        <div className="glass-panel rounded-[1.375rem] p-2.5">
          {/* "Neu starten" is German for restarting a machine, and verbs are
              not capitalised — this heads three things he CREATES. A label,
              so it sits back from the keys it names. */}
          <p className="px-2 pt-1 pb-2.5 text-[0.83rem] leading-4 font-medium text-sidebar-foreground">
            Neu anlegen
          </p>
          <div className="flex flex-col gap-2">
            <SidebarAction icon={Stethoscope} label="Termin aufnehmen" onRun={() => go.record('gespraech')} />
            <SidebarAction icon={Mic} label="Diktat starten" onRun={() => go.record('beurteilung')} />
            <SidebarAction icon={FilePen} label="Bericht erstellen" onRun={go.newDocument} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {loading ? null : (
          <SidebarGroup className="px-4">
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
                      title={documentRowTitle(doc)}
                      subtitle={compactDayTime(doc.updatedAt)}
                      tooltip={doc.title}
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

      <SidebarFooter className="px-4 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={view.name === 'settings'}
              onClick={go.settings}
              // Every other row in the sidebar carries at least medium and
              // stands 40px tall; at 400 and 32px this one read as a caption.
              className="h-10 font-medium"
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
      colorVariant="ocean"
      staticColors
      active={beaming}
      // The ring has to follow the pill, not a rectangle.
      borderRadius={20}
      duration={1.15}
      brightness={2.4}
      saturation={2.4}
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
          // The pill from Mateo's second frame, sampled down its interior:
          // #313131 at the top edge, through #1a1a1a, settling at #171717 and
          // closing on #151515 — top-lit, no border, no ring. Those are his
          // stops, not an approximation of them.
          'flex h-10 w-full items-center gap-2.5 rounded-full px-3.5 text-left',
          'text-sm font-medium tracking-[-0.01em] text-white',
          'bg-[linear-gradient(180deg,#313131_0%,#1e1e1e_22%,#171717_42%,#161616_80%,#151515_100%)]',
          // Hover lifts rather than lightens: the face keeps its colour and
          // the key comes toward you, which is the motion every other control
          // in the app uses.
          'transition-[translate,scale,box-shadow] duration-200 ease-out motion-reduce:transition-none',
          'hover:-translate-y-px hover:scale-[1.01] hover:shadow-[0_6px_14px_-6px_rgba(0,0,0,0.45)]',
          'active:translate-y-0 active:scale-[0.985]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <Icon aria-hidden className="size-[18px] shrink-0 text-white" />
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
            'size-4 text-sidebar-foreground transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <Icon aria-hidden className="text-sidebar-foreground" />
        <span className="flex-1">{label}</span>
        {/* A fixed column: without it the count shifts left the moment a
            branch passes nine items, and the one column that should read as a
            ruler goes ragged. */}
        <span className="w-6 shrink-0 text-right text-sm font-normal text-sidebar-foreground/45 tabular-nums">
          {count}
        </span>
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
              // The branch label starts at 73px (past chevron and icon); its
              // rows started at 49, so the contents hung LEFT of the thing
              // containing them and the hierarchy read backwards.
              'ms-[2.35rem] me-0 pe-0 transition-opacity duration-300 motion-reduce:transition-none',
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
      title={sessionRowTitle(item)}
      subtitle={compactDayTime(item.session.startedAt)}
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
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate text-sm text-sidebar-foreground/50">{subtitle}</span>
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
