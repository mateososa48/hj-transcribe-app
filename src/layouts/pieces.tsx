import { CalendarPlus, MessagesSquare, Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  formatDuration,
  sessionSubtitle,
  sessionTimeTitle,
  useSessions,
  type SessionSummary,
} from '@/features/sessions/useSessions';
import { SESSION_KIND_LABELS, type SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

/** Shared building blocks for the layout experiments. */

export function CtaButtons({ vertical = false }: { vertical?: boolean }) {
  const startRecording = useAppStore((s) => s.startRecording);
  return (
    <div className={cn('flex gap-2', vertical ? 'flex-col' : 'flex-wrap')}>
      <Button size="lg" className="justify-start" onClick={() => startRecording('gespraech')}>
        <CalendarPlus aria-hidden />
        Termin aufnehmen
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="justify-start"
        onClick={() => startRecording('beurteilung')}
      >
        <Mic aria-hidden />
        Diktat starten
      </Button>
    </div>
  );
}

export function KindIcon({ kind, className }: { kind: SessionKind; className?: string }) {
  const Icon = kind === 'gespraech' ? MessagesSquare : Mic;
  return <Icon className={className} aria-hidden />;
}

/** One recording as a plain list row — the workhorse of several layouts. */
export function RecordingRow({
  item,
  active = false,
  onOpen,
  showKind = true,
}: {
  item: SessionSummary;
  active?: boolean;
  onOpen: (id: string) => void;
  showKind?: boolean;
}) {
  const { session } = item;
  return (
    <button
      type="button"
      onClick={() => onOpen(session.id)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active && 'bg-muted',
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <KindIcon kind={session.kind} className="size-4.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{sessionTimeTitle(session)}</span>
        <span className="truncate text-sm text-muted-foreground">{sessionSubtitle(item)}</span>
      </span>
      {showKind ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {SESSION_KIND_LABELS[session.kind]}
        </span>
      ) : null}
    </button>
  );
}

/** Recent recordings as rows, for homes that carry their own history. */
export function RecentList({ limit = 8 }: { limit?: number }) {
  const openSession = useAppStore((s) => s.openSession);
  const { sessions, loading } = useSessions();
  if (loading) return null;
  if (sessions.length === 0) {
    return (
      <p className="px-3 py-4 text-muted-foreground">
        Noch keine Aufnahmen. Alles bleibt auf diesem Computer.
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {sessions.slice(0, limit).map((item) => (
        <li key={item.session.id}>
          <RecordingRow item={item} onOpen={openSession} />
        </li>
      ))}
    </ul>
  );
}

/** Recordings as cards, for the gallery experiment. */
export function SessionCards() {
  const openSession = useAppStore((s) => s.openSession);
  const { sessions, loading } = useSessions();
  if (loading) return null;
  if (sessions.length === 0) {
    return <p className="text-muted-foreground">Noch keine Aufnahmen.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((item) => {
        const { session } = item;
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => openSession(session.id)}
            className={cn(
              'flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left',
              'transition-colors hover:border-foreground/25 hover:bg-muted/50',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                <KindIcon kind={session.kind} className="size-4.5" />
              </span>
              <span className="text-xs text-muted-foreground">
                {SESSION_KIND_LABELS[session.kind]}
                {session.durationMs ? ` · ${formatDuration(session.durationMs)}` : ''}
              </span>
            </span>
            <span className="line-clamp-1 font-medium">{sessionTimeTitle(session)}</span>
            <span className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {sessionSubtitle(item)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
