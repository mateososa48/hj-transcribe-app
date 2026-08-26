import { useEffect, useRef, useState } from 'react';

import { PlayerBar } from '@/components/player-bar';
import { Spinner } from '@/components/ui/spinner';
import type { TimedWord } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useSessionAudio } from './use-session-audio';

/**
 * The recording with a follow-along transcript.
 *
 * While the audio plays, the word being spoken is highlighted and kept in
 * view; clicking any word jumps the audio there. This is what makes checking
 * a dictation fast: he hears a number, sees the word, and knows instantly
 * whether the recognition matched the voice.
 *
 * The words are shown verbatim as recognised — deliberately NOT the repaired
 * text. This panel is the evidence, and evidence is not edited.
 */
export function SyncedPlayback({
  sessionId,
  words,
  fallbackText,
  compact = false,
}: {
  sessionId: string;
  words: TimedWord[];
  fallbackText: string;
  /** Inside a collapsible row: fixed transcript cap instead of filling the panel. */
  compact?: boolean;
}) {
  const { url, missing } = useSessionAudio(sessionId);
  const [activeIndex, setActiveIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef(0);

  // Follow the voice. rAF only while playing; timeupdate alone is too coarse
  // (4 Hz) and makes the highlight visibly lag the audio.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || words.length === 0) return;

    const locate = (ms: number): number => {
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
    const onSeeked = () => setActiveIndex(locate(audio.currentTime * 1000));

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeked', onSeeked);
    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeked', onSeeked);
    };
  }, [words, url]);

  // Keep the spoken word in view while it plays.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (missing) {
    return <p className="px-5 py-4 text-muted-foreground sm:px-6">Zu dieser Aufnahme ist kein Ton mehr gespeichert.</p>;
  }
  if (!url) {
    return (
      <p className="flex items-center gap-3 px-5 py-4 text-muted-foreground sm:px-6">
        <Spinner /> Aufnahme wird geladen …
      </p>
    );
  }

  return (
    <div className={compact ? undefined : 'flex min-h-0 flex-1 flex-col'}>
      {/* Headless element; PlayerBar drives it, the word sync reads it. */}
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      {/* Rows of the Aufnahme panel, not free-standing cards: the panel frame
          does the bounding, a rule separates player from transcript. The
          transcript takes whatever height the letter leaves and scrolls. */}
      <PlayerBar
        src={url}
        audioRef={audioRef}
        className="shrink-0 rounded-none border-0 bg-transparent px-5 py-4 sm:px-6"
      />

      {words.length > 0 ? (
        <div
          className={
            compact
              ? 'max-h-56 overflow-y-auto border-t border-border px-5 py-4 sm:px-6'
              : 'max-h-96 min-h-0 flex-1 overflow-y-auto border-t border-border px-5 py-4 sm:px-6 xl:max-h-none'
          }
        >
          <p className="max-w-[80ch] text-base leading-loose">
            {words.map((word, i) => (
              // The space is a real text node — adjacent inline buttons would
              // otherwise render flush ("DieEjektionsfraktionliegt").
              <span key={i}>
                {i > 0 ? ' ' : ''}
                <button
                  ref={i === activeIndex ? activeRef : undefined}
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
          <p className="mt-3 text-sm text-muted-foreground">
            Der gesprochene Text läuft mit. Klicken Sie auf ein Wort, um dorthin zu springen.
          </p>
        </div>
      ) : fallbackText.trim() ? (
        <div
          className={
            compact
              ? 'max-h-56 overflow-y-auto border-t border-border px-5 py-4 sm:px-6'
              : 'max-h-96 min-h-0 flex-1 overflow-y-auto border-t border-border px-5 py-4 sm:px-6 xl:max-h-none'
          }
        >
          <p className="max-w-[80ch] whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
            {fallbackText}
          </p>
        </div>
      ) : null}
    </div>
  );
}
