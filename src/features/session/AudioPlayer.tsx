import { useEffect, useRef, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { assembleAudio } from '@/lib/db';

/**
 * Playback for one session's recording.
 *
 * The chunks concatenate into a single WebM, but MediaRecorder output carries
 * no duration header — browsers report `Infinity` until the file has been
 * seeked once. The standard fix: seek far past the end, wait, seek back. Ugly,
 * universal, invisible to the user.
 */
export function AudioPlayer({ sessionId }: { sessionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
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
  }, [sessionId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    const fixDuration = () => {
      if (audio.duration === Infinity) {
        const restore = () => {
          audio.currentTime = 0;
          audio.removeEventListener('seeked', restore);
        };
        audio.addEventListener('seeked', restore);
        audio.currentTime = Number.MAX_SAFE_INTEGER;
      }
    };
    audio.addEventListener('loadedmetadata', fixDuration);
    return () => audio.removeEventListener('loadedmetadata', fixDuration);
  }, [url]);

  if (missing) {
    return (
      <p className="text-muted-foreground">Zu dieser Aufnahme ist kein Ton mehr gespeichert.</p>
    );
  }
  if (!url) {
    return (
      <p className="flex items-center gap-3 text-muted-foreground">
        <Spinner /> Aufnahme wird geladen …
      </p>
    );
  }
  return <audio ref={audioRef} src={url} controls preload="metadata" className="w-full" />;
}
