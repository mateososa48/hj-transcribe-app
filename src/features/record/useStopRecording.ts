import { useCallback, useRef, useState } from 'react';

import { recordingSession } from '@/features/record/useRecording';
import { pipeline } from '@/lib/transcription/pipeline';
import { useAppStore } from '@/store/app-store';

/**
 * Ending a sitting, in one place.
 *
 * Two controls can now finish a recording — the button on the recorder screen
 * and the global indicator that follows him everywhere else — and they must do
 * exactly the same four things in the same order: stop the recorder, refresh
 * the library, open the session, start the pipeline. Two copies of that would
 * drift, and the copy that drifts is the one holding a consultation.
 *
 * `stop()` is idempotent at the session level (it returns the existing id if
 * the recorder is no longer running), and the in-flight guard here keeps a
 * double click from starting the pipeline twice.
 */
export function useStopRecording(): { stop: () => Promise<void>; stopping: boolean } {
  const openSession = useAppStore((s) => s.openSession);
  const touchSessions = useAppStore((s) => s.touchSessions);
  const [stopping, setStopping] = useState(false);
  const inFlight = useRef(false);

  const stop = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStopping(true);
    try {
      const sessionId = await recordingSession.stop();
      if (sessionId) {
        touchSessions();
        openSession(sessionId);
        void pipeline.process(sessionId);
      }
    } finally {
      inFlight.current = false;
      setStopping(false);
    }
  }, [openSession, touchSessions]);

  return { stop, stopping };
}
