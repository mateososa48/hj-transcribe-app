import { useEffect, useState } from 'react';
import { ChevronDown, Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RecorderPopup } from '@/features/record/RecorderPopup';
import { db, type Session, type Transcription } from '@/lib/db';
import { processErgaenzung } from '@/lib/ergaenzung';
import { formatDuration } from '@/features/sessions/useSessions';
import { cn } from '@/lib/utils';
import { SyncedPlayback } from './SyncedPlayback';

/**
 * Nachdiktat in place: a small floating window — the running clock and the
 * ribbon of light — records an addition without leaving the page. Finishing
 * hands the audio over and the window leaves at once; the model works the
 * addition into the standing text as a job beside the page, so a second
 * Ergänzung can be spoken while the first is still being worked in. The
 * recording itself files under the Diktat as an Ergänzung.
 */

export function ErgaenzungPopup({
  parentId,
  onCaptured,
  onClose,
}: {
  parentId: string;
  onCaptured: (childId: string) => void;
  onClose: () => void;
}) {
  return (
    <RecorderPopup
      parentId={parentId}
      ariaLabel="Ergänzung aufnehmen"
      destination="Zur Beurteilung"
      onCaptured={onCaptured}
      onClose={onClose}
    />
  );
}

/** The work an Ergänzung does once its window is gone. */
export function ergaenzungJob(parentId: string, childId: string, onMerged: () => void) {
  return {
    processingText: 'Die Ergänzung wird eingearbeitet …',
    successText: 'Eingearbeitet',
    run: async () => {
      await processErgaenzung(parentId, childId);
      onMerged();
    },
  };
}

/** The Ergänzen key for the Aufnahme header. */
export function ErgaenzungButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled} className="rounded-full">
      <Mic aria-hidden />
      Ergänzen
    </Button>
  );
}

interface ErgaenzungRow {
  session: Session;
  transcription: Transcription | null;
}

/**
 * The additional recordings, filed at the bottom of the Aufnahme panel as
 * collapsible rows — each opens smoothly into its own player + follow-along.
 */
export function ErgaenzungList({
  sessionId,
  version,
  label = 'Ergänzung',
}: {
  sessionId: string;
  version: number;
  /** Row word: "Ergänzung" on the Diktat page. */
  label?: string;
}) {
  const [rows, setRows] = useState<ErgaenzungRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const children = (await db.sessions.filter((s) => s.parentId === sessionId).toArray())
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
  }, [sessionId, version]);

  if (rows.length === 0) return null;

  return (
    <div className="shrink-0">
      {rows.map(({ session, transcription }, i) => {
        const open = openId === session.id;
        const time = new Date(session.startedAt).toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div key={session.id} className="border-t border-border">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : session.id)}
              className="flex h-12 w-full items-center justify-between gap-3 px-5 text-left transition-colors hover:bg-muted/40 sm:px-6"
            >
              <span className="text-sm font-medium">
                {i + 1}. {label} · {time} Uhr
                {session.durationMs ? (
                  <span className="text-muted-foreground"> · {formatDuration(session.durationMs)}</span>
                ) : null}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform duration-300',
                  open && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-border">
                  <SyncedPlayback
                    compact
                    sessionId={session.id}
                    words={transcription?.words ?? []}
                    fallbackText={transcription?.text ?? ''}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
