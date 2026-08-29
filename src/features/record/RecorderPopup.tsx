import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RecordingWave } from '@/features/record/RecordingWave';
import type { OrbState } from '@/features/record/RecordingOrb';
import { recordingSession, useElapsed, useRecordingState } from '@/features/record/useRecording';
import { deleteSession } from '@/lib/generate';
import { cn } from '@/lib/utils';

/**
 * The floating dictation window — the running clock and the ribbon of light —
 * that records INTO something without leaving the page.
 *
 * It records and nothing else. Pressing Fertig hands the finished recording to
 * the caller and the window leaves at once, which is what frees the microphone
 * for the next section while the last one is still being written up (see
 * ./dictation-jobs.tsx). Everything after the audio — transcription, drafting,
 * where the text lands — happens out there, per dictation.
 */

type Stage = 'recording' | 'error' | 'closing';

export function RecorderPopup({
  parentId,
  ariaLabel,
  destination,
  onCaptured,
  onClose,
}: {
  /** The session/document this dictation files under (Session.parentId). */
  parentId: string;
  ariaLabel: string;
  /** Where this dictation is headed, shown while he speaks. */
  destination?: string;
  /** The finished child recording. Called once, before the window leaves. */
  onCaptured: (childId: string) => void;
  onClose: () => void;
}) {
  const recording = useRecordingState();
  const [stage, setStage] = useState<Stage>('recording');
  /** The singleton keeps the LAST recording's frozen clock; ignore it until ours runs. */
  const [started, setStarted] = useState(false);
  const [errorText, setErrorText] = useState('');
  const childRef = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // The same singleton recorder as everywhere: chunks flush to disk every
  // five seconds under the child session, crash-safe from the first moment.
  useEffect(() => {
    let cancelled = false;
    void recordingSession.start('beurteilung', { parentId }).then((ok) => {
      if (cancelled) return;
      if (ok) setStarted(true);
      else {
        setErrorText('Es läuft bereits eine Aufnahme.');
        setStage('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  const elapsed = useElapsed(
    started ? recording.startedAt : null,
    started && recording.status === 'recording',
    recording.endedAt,
  );
  const orbState: OrbState =
    recording.status === 'error' ? 'error' : recording.inputWarning ? 'warning' : 'recording';
  const micFailed = stage === 'recording' && recording.status === 'error';

  const close = useCallback(() => {
    setStage('closing');
    timers.current.push(setTimeout(onClose, 220));
  }, [onClose]);

  async function finish() {
    const childId = await recordingSession.stop();
    if (!childId) {
      setErrorText('Die Aufnahme konnte nicht gespeichert werden.');
      setStage('error');
      return;
    }
    childRef.current = childId;
    // Handed over first, so the work is already under way as the window goes.
    onCaptured(childId);
    close();
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
          'pointer-events-auto flex flex-col rounded-2xl border border-border bg-card px-5 py-3.5 shadow-2xl',
          stage === 'closing'
            ? 'motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-bottom-4 motion-safe:duration-200 motion-safe:fill-mode-forwards'
            : 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300',
        )}
      >
        {stage === 'recording' && !micFailed ? (
          <div key="rec" className="flex flex-col motion-safe:animate-in motion-safe:fade-in">
            <div className="flex items-center gap-4">
              <RecordingWave level={recording.level} state={orbState} className="h-12 w-44" />
              <div className="text-2xl font-semibold tabular-nums tracking-tight">{elapsed}</div>
              <Button
                size="lg"
                disabled={!started || recording.status !== 'recording'}
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
            {/* Where the words are going, as a caption under the key that
                sends them — a line he can read, not a slab that doubles the
                width of the window he is speaking into. */}
            {destination ? (
              <p className="mt-1 max-w-[26rem] self-end truncate pe-12 text-xs text-muted-foreground">
                {destination}
              </p>
            ) : null}
          </div>
        ) : micFailed ? (
          <div key="mic" className="flex items-center gap-4 motion-safe:animate-in motion-safe:fade-in">
            <p className="max-w-[36ch] text-sm text-destructive">{recording.error}</p>
            <Button variant="outline" onClick={close}>
              Schließen
            </Button>
          </div>
        ) : (
          <div key="err" className="flex items-center gap-4 motion-safe:animate-in motion-safe:fade-in">
            <p className="max-w-[36ch] text-sm text-destructive">{errorText}</p>
            <Button variant="outline" onClick={close}>
              Schließen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
