import { useEffect, useRef, useState } from 'react';

import { MiniPlayer } from '@/components/mini-player';
import { ScrollBox } from '@/components/scroll-box';
import { useSessionAudio } from '@/features/session/use-session-audio';
import type { Session, Transcription } from '@/lib/db';
import { cn } from '@/lib/utils';

/**
 * One recording, laid out to be checked against something else: the slim
 * player, and under it the words it produced, following the voice as it plays.
 *
 * Shared, because both places that show a recording show exactly this. On a
 * Bericht it is the contents of a widget in the column beside the letter; on a
 * Diktat it sits under the text it became. Neither is the work — this is the
 * evidence he turns to when a number looks wrong, and it should look and
 * behave identically wherever he meets it.
 */
/**
 * `active` gates the audio, not the markup: the body stays mounted so a card
 * knows how tall it opens to, but only the open one assembles its recording —
 * a dozen unplayed dictations must not sit decoded in memory behind closed
 * cards.
 */
export function RecordingBody({
  session,
  transcription,
  active,
}: {
  session: Session;
  transcription: Transcription | null;
  active: boolean;
}) {
  const { url, missing } = useSessionAudio(session.id, active);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeWordRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const words = transcription?.words ?? [];

  // The transcript follows the voice as it plays — the same evidence the
  // Diktat page shows, sized for a card.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || words.length === 0) return;
    const locate = (ms: number) => {
      let lo = 0;
      let hi = words.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (words[mid]!.startMs <= ms) {
          found = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return found;
    };
    const tick = () => {
      setActiveIndex(locate(audio.currentTime * 1000));
      if (!audio.paused) rafRef.current = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => cancelAnimationFrame(rafRef.current);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [words, url]);

  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Pause when the card is closed: a recording playing on behind a shut card
  // is the app talking with nothing on screen to say why.
  useEffect(() => {
    if (!active) audioRef.current?.pause();
  }, [active]);

  return (
    <div className="space-y-2.5">
      <audio ref={audioRef} {...(url ? { src: url } : {})} preload="metadata" className="hidden" />

      {missing ? (
        <p className="text-sm text-muted-foreground">
          Zu dieser Aufnahme ist kein Ton mehr gespeichert.
        </p>
      ) : (
        <MiniPlayer
          audioRef={audioRef}
          {...(session.durationMs ? { fallbackDuration: session.durationMs / 1000 } : {})}
        />
      )}

      {words.length > 0 ? (
        <ScrollBox className="max-h-32 pe-1">
          <p className="text-sm leading-relaxed">
            {words.map((word, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                <button
                  ref={i === activeIndex ? activeWordRef : undefined}
                  type="button"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    audio.currentTime = word.startMs / 1000;
                    setActiveIndex(i);
                    void audio.play();
                  }}
                  className={cn(
                    'rounded-[3px] px-px transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    i === activeIndex
                      ? 'bg-foreground text-background'
                      : i < activeIndex
                        ? 'text-muted-foreground hover:bg-muted'
                        : 'hover:bg-muted',
                  )}
                >
                  {word.text}
                </button>
              </span>
            ))}
          </p>
        </ScrollBox>
      ) : transcription?.text.trim() ? (
        <ScrollBox className="max-h-32 pe-1">
          <p className="text-sm leading-relaxed">{transcription.text}</p>
        </ScrollBox>
      ) : null}
    </div>
  );
}
