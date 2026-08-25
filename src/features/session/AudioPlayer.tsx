import { useEffect, useState } from 'react';

import { PlayerBar } from '@/components/player-bar';
import { Spinner } from '@/components/ui/spinner';
import { assembleAudio } from '@/lib/db';

/** Playback for one session's recording (the Termin Audio tab). */
export function AudioPlayer({ sessionId }: { sessionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

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
  return <PlayerBar src={url} />;
}
