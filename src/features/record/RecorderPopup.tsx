import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { RecordingWave } from '@/features/record/RecordingWave';
import type { OrbState } from '@/features/record/RecordingOrb';
import { recordingSession, useElapsed, useRecordingState } from '@/features/record/useRecording';
import { deleteSession } from '@/lib/generate';
import { cn } from '@/lib/utils';

/**
 * The floating dictation window — the running clock and the ribbon of light —
 * that records INTO something without leaving the page. What happens with the
 * finished audio is injected: the Diktat page merges it into the standing
 * Beurteilung, the Bericht editor turns it into a section. The window itself
 * only knows record → process → check mark → slide away.
 */

type Stage = 'recording' | 'processing' | 'success' | 'error' | 'closing';

export function RecorderPopup({
  parentId,
  ariaLabel,
  processingText,
  process,
  onDone,
  onClose,
}: {
  /** The session/document this dictation files under (Session.parentId). */
  parentId: string;
  ariaLabel: string;
  processingText: string;
  /** The injected async step: transcribe + whatever the caller does with it. */
  process: (childId: string) => Promise<void>;
  onDone: () => void;
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

  const run = useCallback(
    async (childId: string) => {
      setStage('processing');
      try {
        await process(childId);
        setStage('success');
        timers.current.push(
          setTimeout(() => {
            onDone();
            setStage('closing');
            timers.current.push(setTimeout(onClose, 220));
          }, 1000),
        );
      } catch (error) {
        setErrorText(
          error instanceof Error ? error.message : 'Das Diktat konnte nicht verarbeitet werden.',
        );
        setStage('error');
      }
    },
    [process, onDone, onClose],
  );

  async function finish() {
    const childId = await recordingSession.stop();
    if (!childId) {
      setErrorText('Die Aufnahme konnte nicht gespeichert werden.');
      setStage('error');
      return;
    }
    childRef.current = childId;
    await run(childId);
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
        aria-label={ariaLabel}
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
            <p className="text-base text-muted-foreground">{processingText}</p>
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
              onClick={() => childRef.current && void run(childRef.current)}
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
