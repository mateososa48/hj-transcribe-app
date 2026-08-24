import { useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { SessionKind } from '@/lib/db';
import { pipeline } from '@/lib/transcription/pipeline';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { OrbState } from './RecordingOrb';
import { RecordingWave } from './RecordingWave';
import { recordingSession, useElapsed, useRecordingState } from './useRecording';

/**
 * The two recorders, deliberately unalike.
 *
 * TERMIN runs while he talks to a patient: it stays inside the app frame,
 * calm, glanceable from across the desk — the recording is the background of
 * the appointment, not its subject.
 *
 * DIKTAT is the opposite: he is alone, the recording IS the task. It takes the
 * whole screen, goes dark, and the ribbon becomes light itself (the shader's
 * additive mode). Nothing else is on screen because nothing else matters.
 */
export function RecordFlow({ kind }: { kind: SessionKind }) {
  const goHome = useAppStore((s) => s.goHome);
  const openSession = useAppStore((s) => s.openSession);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const recording = useRecordingState();
  const [starting, setStarting] = useState(false);

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
        // Fire the pipeline; the session view renders its progress.
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

  const alerts = (
    <>
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
    </>
  );

  if (kind === 'beurteilung') {
    // ── Diktat: full-screen focus mode ────────────────────────────────────
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-neutral-50">
        <div className="flex items-center justify-between px-6 py-5">
          <Button
            variant="ghost"
            size="lg"
            onClick={goHome}
            disabled={isRecording}
            className="text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            <ArrowLeft aria-hidden />
            Zurück
          </Button>
          <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
            Diktat
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
          <p className="max-w-[46ch] text-center text-lg text-neutral-400">
            {isRecording
              ? 'Ihr Diktat wird aufgenommen.'
              : 'Sprechen Sie frei, wie zu einem Kollegen. Satzzeichen müssen Sie nicht mitsprechen.'}
          </p>
          <div className="text-8xl font-semibold tabular-nums tracking-tight">{elapsed}</div>
          <RecordingWave level={recording.level} state={orbState} dark className="h-52" />
          {alerts}
          <Button
            size="lg"
            disabled={isBusy}
            onClick={() => void handleToggle()}
            className={cn(
              'h-16 px-12 text-lg',
              isRecording
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-neutral-50 text-neutral-950 hover:bg-neutral-200',
            )}
          >
            {isBusy ? <Spinner /> : null}
            {isRecording ? 'Diktat beenden' : 'Aufnahme starten'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Termin: calm, in-frame ──────────────────────────────────────────────
  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="lg" onClick={goHome} disabled={isRecording}>
          <ArrowLeft aria-hidden />
          Zurück
        </Button>
        <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Termin
        </span>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Termin aufnehmen</h1>
        <p className="max-w-[56ch] text-lg text-muted-foreground">
          {isRecording
            ? 'Die Aufnahme läuft — führen Sie das Gespräch ganz normal.'
            : 'Starten Sie die Aufnahme, bevor der Patient hereinkommt. Sie können ganz normal sprechen.'}
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card px-6 py-10">
        <div className="text-6xl font-semibold tabular-nums tracking-tight">{elapsed}</div>
        <RecordingWave level={recording.level} state={orbState} className="h-36" />
        {alerts}
        <Button
          size="lg"
          disabled={isBusy}
          className={cn(
            'h-14 px-10 text-lg',
            isRecording && 'bg-destructive text-white hover:bg-destructive/90',
          )}
          onClick={() => void handleToggle()}
        >
          {isBusy ? <Spinner /> : null}
          {isRecording ? 'Termin beenden' : 'Aufnahme starten'}
        </Button>
        {isRecording ? (
          <p className="text-sm text-muted-foreground">
            Die Aufnahme wird laufend auf diesem Computer gesichert.
          </p>
        ) : null}
      </div>

      {!isRecording ? (
        <p className="max-w-[56ch] text-sm text-muted-foreground">
          Nach dem Termin entstehen automatisch: Notizen in Abschnitten, das Transkript nach
          Sprechern getrennt und die Aufnahme zum Nachhören.
        </p>
      ) : null}
    </div>
  );
}
