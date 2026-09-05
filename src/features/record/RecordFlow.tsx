import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, PauseCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { SessionKind } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { OrbState } from './RecordingOrb';
import { RecordControls } from './RecordControls';
import { RecordingWave } from './RecordingWave';
import { recordingSession, useElapsed, useRecordingState } from './useRecording';
import { useStopRecording } from './useStopRecording';

const COPY: Record<
  SessionKind,
  { heading: string; idle: string; running: string; paused: string; stop: string; after: string }
> = {
  gespraech: {
    heading: 'Termin aufnehmen',
    idle: 'Starten Sie die Aufnahme, bevor der Patient hereinkommt. Sie können ganz normal sprechen.',
    running: 'Die Aufnahme läuft — führen Sie das Gespräch ganz normal.',
    paused: 'Der Termin ist angehalten. Es wird gerade nichts aufgezeichnet.',
    stop: 'Termin beenden',
    after:
      'Nach dem Termin entstehen automatisch: Notizen in Abschnitten, das Transkript nach Sprechern getrennt und die Aufnahme zum Nachhören.',
  },
  beurteilung: {
    heading: 'Diktat aufnehmen',
    idle: 'Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.',
    running: 'Ihr Diktat wird aufgenommen.',
    paused: 'Das Diktat ist angehalten. Es wird gerade nichts aufgezeichnet.',
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
  const touchSessions = useAppStore((s) => s.touchSessions);
  const recording = useRecordingState();
  const { stop: stopRecording } = useStopRecording();
  const [starting, setStarting] = useState(false);
  const copy = COPY[kind];

  // A fresh recorder screen starts at 00:00 — without this, the singleton
  // still holds the last session's frozen timer and shows e.g. 04:00.
  useEffect(() => {
    recordingSession.reset();
  }, [kind]);

  const isRecording = recording.status === 'recording';
  const isPaused = recording.status === 'paused';
  // A paused sitting is still a sitting: the microphone is held, the audio is
  // on disk, and leaving the screen would abandon it.
  const isLive = isRecording || isPaused;
  const isBusy = recording.status === 'requesting-mic' || recording.status === 'stopping' || starting;

  const elapsed = useElapsed(
    recording.startedAt,
    isRecording,
    // While paused the clock freezes at the moment of pausing, not at endedAt.
    recording.pausedAt ?? recording.endedAt,
    recording.pausedMs,
  );

  const orbState: OrbState =
    recording.status === 'error'
      ? 'error'
      : recording.inputWarning
        ? 'warning'
        : isPaused
          ? 'paused'
          : isRecording
            ? 'recording'
            : 'idle';

  async function handleStart() {
    setStarting(true);
    try {
      await recordingSession.start(kind);
      touchSessions();
    } finally {
      setStarting(false);
    }
  }

  function handleToggleHold() {
    if (recordingSession.getState().status === 'paused') recordingSession.resume();
    else recordingSession.pause();
  }

  // Arriving here is a mode change — the room goes quiet and the instrument
  // comes up. It must not blink into place: the page settles in, and the
  // instrument panel follows a beat later, which is what makes pressing
  // „Diktat starten" feel like one continuous movement rather than a jump.
  return (
    <div className="space-y-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="lg" onClick={goHome} disabled={isLive}>
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
          {isPaused ? copy.paused : isRecording ? copy.running : copy.idle}
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card px-6 py-10 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-[0.98] motion-safe:duration-700 motion-safe:delay-100 motion-safe:fill-mode-backwards motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]">
        {/* The mode badge sits directly above the clock, in the gap the layout
            already leaves, so nothing below it moves when a pause begins. It
            carries role="status" because the visual change — a frozen clock and
            a settled ribbon — is not announced anywhere else. */}
        <div className="flex h-7 items-center justify-center">
          {isPaused ? (
            <span
              role="status"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1',
                'text-sm font-medium text-muted-foreground',
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200',
              )}
            >
              <PauseCircle aria-hidden className="size-3.5" />
              Pausiert
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            'text-6xl font-semibold tabular-nums tracking-tight',
            'transition-colors duration-300',
            isPaused && 'text-muted-foreground',
          )}
        >
          {elapsed}
        </div>
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

        {isLive ? (
          <RecordControls
            paused={isPaused}
            busy={isBusy}
            stopLabel={copy.stop}
            onToggleHold={handleToggleHold}
            onStop={() => void stopRecording()}
          />
        ) : (
          <Button
            size="lg"
            disabled={isBusy}
            className="h-14 rounded-full px-10 text-lg"
            onClick={() => void handleStart()}
          >
            {isBusy ? <Spinner /> : null}
            Aufnahme starten
          </Button>
        )}

        {isLive ? (
          <p
            className={cn(
              'text-sm transition-colors duration-300',
              isPaused ? 'text-muted-foreground/70' : 'text-muted-foreground',
            )}
          >
            {isPaused
              ? 'Das bisher Aufgenommene ist gesichert.'
              : 'Die Aufnahme wird laufend auf diesem Computer gesichert.'}
          </p>
        ) : null}
      </div>

      {!isRecording ? (
        <p className="max-w-[56ch] text-sm text-muted-foreground">{copy.after}</p>
      ) : null}
    </div>
  );
}
