import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { SessionKind } from '@/lib/db';
import type { OrbState } from './RecordingOrb';
import { RecordingWave } from './RecordingWave';
import {
  recordingSession,
  transcriptionQueue,
  useElapsed,
  useQueueState,
  useRecordingState,
} from './useRecording';

/**
 * One screen for both features.
 *
 * The only thing that differs is the sentence at the top telling him what to
 * do; everything below — timer, ribbon, one big button — is identical, so the
 * second feature costs him nothing to learn once he knows the first.
 */

const COPY: Record<SessionKind, { heading: string; idle: string; running: string }> = {
  gespraech: {
    heading: 'Gespräch aufnehmen',
    idle: 'Starten Sie die Aufnahme, bevor der Patient hereinkommt. Sie können ganz normal sprechen.',
    running: 'Das Gespräch wird aufgenommen.',
  },
  beurteilung: {
    heading: 'Beurteilung diktieren',
    idle: 'Sprechen Sie frei, so wie Sie es einem Kollegen erklären würden. Satzzeichen müssen Sie nicht mitsprechen.',
    running: 'Ihr Diktat wird aufgenommen.',
  },
};

export function RecordScreen({
  kind,
  onBack,
  onFinished,
}: {
  kind: SessionKind;
  onBack: () => void;
  onFinished: (sessionId: string) => void;
}) {
  const recording = useRecordingState();
  const queue = useQueueState();
  const [starting, setStarting] = useState(false);
  const elapsed = useElapsed(recording.startedAt, recording.status === 'recording', recording.endedAt);
  const copy = COPY[kind];

  // The queue runs whenever the app is open, not only while recording — that is
  // what lets a segment that failed earlier catch up by itself.
  useEffect(() => {
    transcriptionQueue.start();
    return () => transcriptionQueue.stop();
  }, []);

  const isRecording = recording.status === 'recording';
  const isBusy = recording.status === 'requesting-mic' || recording.status === 'stopping' || starting;

  const orbState: OrbState =
    recording.status === 'error'
      ? 'error'
      : recording.inputWarning
        ? 'warning'
        : isRecording
          ? 'recording'
          : 'idle';

  async function handleToggle() {
    if (isRecording) {
      const sessionId = await recordingSession.stop();
      if (sessionId) onFinished(sessionId);
      return;
    }
    setStarting(true);
    try {
      await recordingSession.start(kind);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 py-1">
      <div className="w-full">
        <Button variant="ghost" size="lg" onClick={onBack} disabled={isRecording}>
          <ArrowLeft aria-hidden />
          Zurück
        </Button>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.heading}</h1>
        <p className="mx-auto max-w-[52ch] text-lg text-muted-foreground">
          {isRecording ? copy.running : copy.idle}
        </p>
      </div>

      {/* Largest thing on screen: from two metres away this is what answers
          "is it running?". tabular-nums, not font-mono — no mono family is
          bundled, and Geist's tabular figures stop the digits jittering. */}
      <div className="text-6xl font-semibold tabular-nums tracking-tight">{elapsed}</div>

      <RecordingWave level={recording.level} state={orbState} />

      {recording.inputWarning ? (
        <div
          role="alert"
          className="flex max-w-[60ch] items-start gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-base">{recording.inputWarning}</p>
        </div>
      ) : null}

      {recording.error ? (
        <div
          role="alert"
          className="flex max-w-[60ch] items-start gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-base">{recording.error}</p>
        </div>
      ) : null}

      <Button
        size="lg"
        variant={isRecording ? 'destructive' : 'default'}
        disabled={isBusy}
        className="h-16 px-12 text-lg"
        onClick={() => void handleToggle()}
      >
        {isBusy ? <Spinner /> : null}
        {isRecording ? 'Aufnahme beenden' : 'Aufnahme starten'}
      </Button>

      {/* Outstanding work is worth showing even here — it is how he knows
          nothing has been lost. Plain language: "wird nachgeholt" tells him the
          only thing he needs to know. */}
      {recording.segmentCount > 0 || queue.pending > 0 || queue.running > 0 || queue.failed > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {recording.segmentCount > 0 ? (
            <Badge variant="secondary">
              {recording.segmentCount} Abschnitt{recording.segmentCount === 1 ? '' : 'e'} gespeichert
            </Badge>
          ) : null}
          {queue.pending > 0 || queue.running > 0 ? (
            <Badge variant="outline">
              <Spinner className="size-3.5" />
              {queue.pending + queue.running} in Arbeit
            </Badge>
          ) : null}
          {queue.failed > 0 ? (
            <>
              <Badge variant="outline" className="text-destructive">
                {queue.failed} wird nachgeholt
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void transcriptionQueue.retryFailed();
                  toast.info('Wird erneut versucht.');
                }}
              >
                <RotateCcw aria-hidden />
                Jetzt erneut versuchen
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
