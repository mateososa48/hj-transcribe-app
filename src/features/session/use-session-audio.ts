import { useEffect, useState } from 'react';

import { assembleAudio } from '@/lib/db';

/**
 * Object URL for a session's assembled recording. `url` is null while the
 * chunks are being read; `missing` becomes true when the session has no audio
 * left (deleted or never persisted). The URL is revoked on unmount.
 *
 * `enabled` exists for the dictation widgets: a Bericht can hold a dozen, and
 * assembling every one of their recordings to sit unplayed behind a closed
 * card would hold the lot in memory. Only the open one reads its audio.
 */
export function useSessionAudio(
  sessionId: string,
  enabled = true,
): { url: string | null; missing: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setMissing(false);
    if (!enabled) return;
    void assembleAudio(sessionId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionId, enabled]);

  return { url, missing };
}
