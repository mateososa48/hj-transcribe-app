import { useEffect, useState } from 'react';

import { BouncyAccordion } from '@/components/motion/bouncy-accordion';
import { RecordingBody } from '@/components/recording-body';
import { formatDuration } from '@/features/sessions/useSessions';
import { db, type Session, type Transcription } from '@/lib/db';

/**
 * The dictations recorded into this Bericht, as a column of small widgets
 * beside the page.
 *
 * They used to sit in a bordered panel with a heading and hairline-divided
 * rows — a sidebar, and it read as one: a container of app furniture parked
 * against the letter. These are separate cards standing in open space, newest
 * arriving underneath the last. Each is one line until he drops it open, and
 * then it is only what checking a dictation needs: the recording, and the
 * words that came out of it.
 */
interface RailRow {
  session: Session;
  transcription: Transcription | null;
}

export function DictationRail({
  documentId,
  version,
}: {
  documentId: string;
  /** Bumped by the caller when a dictation finishes, to re-read the rows. */
  version: number;
}) {
  const [rows, setRows] = useState<RailRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const children = (await db.sessions.filter((s) => s.parentId === documentId).toArray())
        .filter((s) => s.status === 'stopped')
        .sort((a, b) => a.startedAt - b.startedAt);
      const withText = await Promise.all(
        children.map(async (session) => ({
          session,
          transcription:
            (await db.transcriptions.where('sessionId').equals(session.id).first()) ?? null,
        })),
      );
      if (!cancelled) setRows(withText);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, version]);

  if (rows.length === 0) return null;

  const items = rows.map(({ session, transcription }) => {
    return {
      id: session.id,
      title: (
        <span className="flex w-full min-w-0 flex-col items-start gap-1">
          {/* The length sits with the word it describes, not flung out to the
              far edge — pinned opposite, it read as an orphan with a hole in
              the middle of the row and made an L with the tag below. The row
              below still keeps its full width for the section's real name. */}
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium">Diktat</span>
            {session.durationMs ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                · {formatDuration(session.durationMs)}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {session.targetSection ?? 'Ohne Abschnitt'}
          </span>
        </span>
      ),
      description: (
        <RecordingBody
          session={session}
          transcription={transcription}
          active={openId === session.id}
        />
      ),
    };
  });

  return (
    // Same ground as the canvas the page sits on, so the widgets read as
    // resting on the desk beside the letter rather than on a panel of their own.
    <aside
      aria-label="Diktate in diesem Bericht"
      className="hidden w-72 shrink-0 lg:block"
    >
      <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto py-10 pe-8 ps-0">
        <BouncyAccordion
          separated
          radius={14}
          items={items}
          value={openId}
          onValueChange={setOpenId}
          classNames={{
            item: 'border border-border shadow-sm',
            trigger: 'min-h-12 gap-2 px-4 py-2.5',
            title: 'text-sm font-normal',
            chevron: 'size-5',
            description: 'text-sm text-foreground',
          }}
        />
      </div>
    </aside>
  );
}
