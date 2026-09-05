import { useEffect, useState, useSyncExternalStore } from 'react';

import { formatElapsed } from './elapsed.ts';
import { RecordingSession, type RecordingState } from '@/lib/session/recording-session.ts';
import { pipeline, type PipelineState } from '@/lib/transcription/pipeline.ts';

/**
 * Module-level singleton on purpose: a recording must survive React remounting
 * the view — tying an in-flight recording to a render tree is exactly the
 * class of bug that loses audio.
 */
export const recordingSession = new RecordingSession();

export function useRecordingState(): RecordingState {
  const [state, setState] = useState<RecordingState>(() => recordingSession.getState());
  useEffect(() => recordingSession.subscribe(setState), []);
  return state;
}

const IDLE_PIPELINE: PipelineState = { phase: 'idle', error: null, phaseStartedAt: 0 };

/** Live phase of the stop→transcript→notes pipeline for one session. */
export function usePipelineState(sessionId: string | null): PipelineState {
  return useSyncExternalStore(
    (cb) => pipeline.subscribe(cb),
    () => (sessionId ? pipeline.get(sessionId) : IDLE_PIPELINE),
  );
}

/**
 * MM:SS of CAPTURED time — counting while recording, frozen while paused and
 * once stopped. The ticker only runs while it can change anything.
 */
export function useElapsed(
  startedAt: number | null,
  running: boolean,
  frozenAt: number | null = null,
  pausedMs = 0,
): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);

  return formatElapsed(startedAt, frozenAt, now, running, pausedMs);
}
