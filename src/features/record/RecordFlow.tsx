import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { SessionKind } from '@/lib/db';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { OrbState } from './RecordingOrb';
import { RecordingWave } from './RecordingWave';
import { recordingSession, useElapsed, useRecordingState } from './useRecording';

const COPY: Record<SessionKind, { heading: string; idle: string; running: string; stop: string; after: string }> = {
  gespraech: {
    heading: 'Termin aufnehmen',
    idle: 'Starten Sie die Aufnahme, bevor der Patient hereinkommt. Sie können ganz normal sprechen.',
    running: 'Die Aufnahme läuft — führen Sie das Gespräch ganz normal.',
    stop: 'Termin beenden',
    after:
      'Nach dem Termin entstehen automatisch: Notizen in Abschnitten, das Transkript nach Sprechern getrennt und die Aufnahme zum Nachhören.',
  },
  beurteilung: {
    heading: 'Diktat aufnehmen',
    idle: 'Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.',
    running: 'Ihr Diktat wird aufgenommen.',
    stop: 'Diktat beenden',
    after: 'Nach dem Diktat entsteht die Zusammenfassende Beurteilung — fertig zum Einfügen in Word.',
  },
};

/**
 * One recorder layout for both features, inside the app frame with the sidebar
 * in place. (An earlier version gave Diktat a black full-screen takeover; it
 * looked the part and was asked out — the sidebar stays, the page stays white.)
 */
export function RecordFlow({ kind }: { kind: SessionKind }) {
  const goHome = useAppStore((s) => s.goHome);
  const openSession = useAppStore((s) => s.openSession);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const recording = useRecordingState();
  const [starting, setStarting] = useState(false);
  const copy = COPY[kind];

  // A fresh recorder screen starts at 00:00 — without this, the singleton
  // still holds the last session's frozen timer and shows e.g. 04:00.
  useEffect(() => {
    recordingSession.reset();
  }, [kind]);

  const elapsed = useElapsed(
    recording.startedAt,
    recording.status === 'recording',
    recording.endedAt,
  );
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
      if (sessionId) {
        touchSessions();
        openSession(sessionId);
        void pipeline.process(sessionId);
      }
      return;
    }
    setStarting(true);
    try {
      await recordingSession.start(kind);
      touchSessions();
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="lg" onClick={goHome} disabled={isRecording}>
          <ArrowLeft aria-hidden />
          Zurück
        </Button>
        <Badge variant={kind === 'gespraech' ? 'secondary' : 'outline'}>
          {kind === 'gespraech' ? 'Termin' : 'Diktat'}
        </Badge>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.heading}</h1>
        <p className="max-w-[56ch] text-lg text-muted-foreground">
          {isRecording ? copy.running : copy.idle}
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card px-6 py-10">
        <div className="text-6xl font-semibold tabular-nums tracking-tight">{elapsed}</div>
        <RecordingWave level={recording.level} state={orbState} className="h-36" />

        {recording.inputWarning ? (
          <div
            role="alert"
            className="flex max-w-[56ch] items-start gap-3 rounded-lg bg-destructive/15 px-4 py-3 text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-base">{recording.inputWarning}</p>
          </div>
        ) : null}
        {recording.error ? (
          <div
            role="alert"
            className="flex max-w-[56ch] items-start gap-3 rounded-lg bg-destructive/15 px-4 py-3 text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-base">{recording.error}</p>
          </div>
        ) : null}

        <Button
          size="lg"
          disabled={isBusy}
          className={cn(
            'h-14 px-10 text-lg',
            isRecording && 'btn-gloss bg-destructive text-white hover:bg-destructive/90',
          )}
          onClick={() => void handleToggle()}
        >
          {isBusy ? <Spinner /> : null}
          {isRecording ? copy.stop : 'Aufnahme starten'}
        </Button>

        {isRecording ? (
          <p className="text-sm text-muted-foreground">
            Die Aufnahme wird laufend auf diesem Computer gesichert.
          </p>
        ) : null}
      </div>

      {!isRecording ? (
        <p className="max-w-[56ch] text-sm text-muted-foreground">{copy.after}</p>
      ) : null}
    </div>
  );
}
