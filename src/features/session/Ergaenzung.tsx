import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Mic, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { RecordingWave } from '@/features/record/RecordingWave';
import type { OrbState } from '@/features/record/RecordingOrb';
import { recordingSession, useElapsed, useRecordingState } from '@/features/record/useRecording';
import { db, type Session, type Transcription } from '@/lib/db';
import { processErgaenzung } from '@/lib/ergaenzung';
import { deleteSession } from '@/lib/generate';
import { formatDuration } from '@/features/sessions/useSessions';
import { cn } from '@/lib/utils';
import { SyncedPlayback } from './SyncedPlayback';

/**
 * Nachdiktat in place: a small floating window — the running clock and the
 * ribbon of light — records an addition without leaving the page. Finishing
 * hands the audio to the same pipeline, the model works the addition into
 * the standing text, and the window resolves into a check mark before it
 * slides away. The recording itself files under the Diktat as an Ergänzung.
 */

type Stage = 'recording' | 'processing' | 'success' | 'error' | 'closing';

export function ErgaenzungPopup({
  parentId,
  onMerged,
  onClose,
}: {
  parentId: string;
  onMerged: () => void;
  onClose: () => void;
}) {
  const recording = useRecordingState();
  const [stage, setStage] = useState<Stage>('recording');
  const [errorText, setErrorText] = useState('');
  const childRef = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // The same singleton recorder as everywhere: chunks flush to disk every
  // five seconds under the child session, crash-safe from the first moment.
  useEffect(() => {
    void recordingSession.start('beurteilung', { parentId });
  }, [parentId]);

  const elapsed = useElapsed(
    recording.startedAt,
    recording.status === 'recording',
    recording.endedAt,
  );
  const orbState: OrbState =
    recording.status === 'error' ? 'error' : recording.inputWarning ? 'warning' : 'recording';
  const micFailed = stage === 'recording' && recording.status === 'error';

  const close = useCallback(() => {
    setStage('closing');
    timers.current.push(setTimeout(onClose, 220));
  }, [onClose]);

  const merge = useCallback(
    async (childId: string) => {
      setStage('processing');
      try {
        await processErgaenzung(parentId, childId);
        setStage('success');
        timers.current.push(
          setTimeout(() => {
            onMerged();
            setStage('closing');
            timers.current.push(setTimeout(onClose, 220));
          }, 1000),
        );
      } catch (error) {
        setErrorText(
          error instanceof Error ? error.message : 'Die Ergänzung konnte nicht eingearbeitet werden.',
        );
        setStage('error');
      }
    },
    [parentId, onMerged, onClose],
  );

  async function finish() {
    const childId = await recordingSession.stop();
    if (!childId) {
      setErrorText('Die Aufnahme konnte nicht gespeichert werden.');
      setStage('error');
      return;
    }
    childRef.current = childId;
    await merge(childId);
  }

  async function discard() {
    if (recording.status === 'recording' || recording.status === 'requesting-mic') {
      const childId = await recordingSession.stop();
      if (childId) await deleteSession(childId);
    } else if (childRef.current) {
      await deleteSession(childRef.current);
    }
    close();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        role="dialog"
        aria-label="Ergänzung aufnehmen"
        className={cn(
          'pointer-events-auto flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-2xl',
          stage === 'closing'
            ? 'motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-bottom-4 motion-safe:duration-200 motion-safe:fill-mode-forwards'
            : 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300',
        )}
      >
        {stage === 'recording' && !micFailed ? (
          <div key="rec" className="flex items-center gap-4 motion-safe:animate-in motion-safe:fade-in">
            <RecordingWave level={recording.level} state={orbState} className="h-12 w-44" />
            <div className="text-2xl font-semibold tabular-nums tracking-tight">{elapsed}</div>
            <Button
              size="lg"
              disabled={recording.status !== 'recording'}
              onClick={() => void finish()}
              className="rounded-full"
            >
              <Check aria-hidden />
              Fertig
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Verwerfen"
              className="text-muted-foreground"
              onClick={() => void discard()}
            >
              <X aria-hidden />
            </Button>
          </div>
        ) : micFailed ? (
          <div key="mic" className="flex items-center gap-4 motion-safe:animate-in motion-safe:fade-in">
            <p className="max-w-[36ch] text-sm text-destructive">{recording.error}</p>
            <Button variant="outline" onClick={close}>
              Schließen
            </Button>
          </div>
        ) : stage === 'processing' ? (
          <div key="proc" className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in">
            <Spinner className="size-5" />
            <p className="text-base text-muted-foreground">Die Ergänzung wird eingearbeitet …</p>
          </div>
        ) : stage === 'success' || stage === 'closing' ? (
          <div key="ok" className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in">
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-background motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
              <Check className="size-5" aria-hidden />
            </span>
            <p className="text-base font-medium">Eingearbeitet</p>
          </div>
        ) : (
          <div key="err" className="flex items-center gap-4 motion-safe:animate-in motion-safe:fade-in">
            <p className="max-w-[36ch] text-sm text-destructive">{errorText}</p>
            <Button
              variant="outline"
              onClick={() => childRef.current && void merge(childRef.current)}
            >
              <RotateCcw aria-hidden />
              Erneut versuchen
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => void discard()}>
              Verwerfen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
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
export function ErgaenzungList({ sessionId, version }: { sessionId: string; version: number }) {
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
                {i + 1}. Ergänzung · {time} Uhr
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
