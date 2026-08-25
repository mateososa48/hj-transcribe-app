import { useEffect, useState } from 'react';

import type { OrbState } from '@/features/record/RecordingOrb';
import { recordingSession, useElapsed, useRecordingState } from '@/features/record/useRecording';
import { pipeline } from '@/lib/transcription/pipeline';
import { useAppStore } from '@/store/app-store';

/**
 * Everything a Diktat recording screen DOES, with no opinion about how it
 * looks — the ten design experiments each dress this one behaviour.
 */
export function useDiktatRecorder() {
  const goHome = useAppStore((s) => s.goHome);
  const openSession = useAppStore((s) => s.openSession);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const recording = useRecordingState();
  const [starting, setStarting] = useState(false);

  // A fresh recorder screen starts at 00:00 — the singleton otherwise still
  // holds the last session's frozen timer.
  useEffect(() => {
    recordingSession.reset();
  }, []);

  const elapsed = useElapsed(
    recording.startedAt,
    recording.status === 'recording',
    recording.endedAt,
  );
  const isRecording = recording.status === 'recording';
  const isBusy =
    recording.status === 'requesting-mic' || recording.status === 'stopping' || starting;

  const orbState: OrbState =
    recording.status === 'error'
      ? 'error'
      : recording.inputWarning
        ? 'warning'
        : isRecording
          ? 'recording'
          : 'idle';

  async function toggle() {
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
      await recordingSession.start('beurteilung');
      touchSessions();
    } finally {
      setStarting(false);
    }
  }

  return { recording, elapsed, isRecording, isBusy, orbState, toggle, goHome };
}
