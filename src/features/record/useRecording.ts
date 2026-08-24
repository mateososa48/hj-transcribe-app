import { useEffect, useState } from 'react';

import { formatElapsed } from './elapsed.ts';

import {
  RecordingSession,
  findRecoverableSessions,
  type RecordingState,
} from '@/lib/session/recording-session.ts';
import { TranscriptionQueue, type QueueState } from '@/lib/transcription/queue.ts';
import type { Session } from '@/lib/db.ts';

/**
 * Module-level singletons on purpose.
 *
 * A recording must survive React remounting the view — putting the session or
 * the queue in component state would tie an in-flight recording to a render
 * tree, which is exactly the class of bug that loses audio.
 */
export const recordingSession = new RecordingSession();
export const transcriptionQueue = new TranscriptionQueue();

export function useRecordingState(): RecordingState {
  const [state, setState] = useState<RecordingState>(() => recordingSession.getState());
  useEffect(() => recordingSession.subscribe(setState), []);
  return state;
}

export function useQueueState(): QueueState {
  const [state, setState] = useState<QueueState>(() => transcriptionQueue.getState());
  useEffect(() => transcriptionQueue.subscribe(setState), []);
  return state;
}

/** Sessions left mid-recording by a crash or a closed tab. */
export function useRecoverableSessions(): {
  sessions: Session[];
  refresh: () => Promise<void>;
} {
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = async () => {
    setSessions(await findRecoverableSessions());
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { sessions, refresh };
}

/** MM:SS, counting up from a start timestamp. */
export function useElapsed(
  startedAt: number | null,
  running: boolean,
  endedAt: number | null = null,
): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);

  return formatElapsed(startedAt, endedAt, now, running);
}

