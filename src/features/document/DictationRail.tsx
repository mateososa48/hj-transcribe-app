import { useEffect, useRef, useState } from 'react';

import { BouncyAccordion } from '@/components/motion/bouncy-accordion';
import { MiniPlayer } from '@/components/mini-player';
import { ScrollBox } from '@/components/scroll-box';
import { formatDuration } from '@/features/sessions/useSessions';
import { useSessionAudio } from '@/features/session/use-session-audio';
import { db, type Session, type Transcription } from '@/lib/db';
import { cn } from '@/lib/utils';

/**
 * The dictations recorded into this Bericht, as a column of small widgets
 * beside the page.
 *
 * They used to sit in a bordered panel with a heading and hairline-divided
 * rows — a sidebar, and it read as one: a container of app furniture parked
 * against the letter. These are separate cards standing in open space, newest
 * arriving underneath the last. Each is one line until he drops it open, and
 * then it is only what checking a dictation needs: the recording, and the
 * words that came out of it.
 */
interface RailRow {
  session: Session;
  transcription: Transcription | null;
}

export function DictationRail({
  documentId,
  version,
}: {
  documentId: string;
  /** Bumped by the caller when a dictation finishes, to re-read the rows. */
  version: number;
}) {
  const [rows, setRows] = useState<RailRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const children = (await db.sessions.filter((s) => s.parentId === documentId).toArray())
        .filter((s) => s.status === 'stopped')
        .sort((a, b) => a.startedAt - b.startedAt);
      const withText = await Promise.all(
        children.map(async (session) => ({
          session,
          transcription:
            (await db.transcriptions.where('sessionId').equals(session.id).first()) ?? null,
        })),
      );
      if (!cancelled) setRows(withText);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, version]);

  if (rows.length === 0) return null;

  const items = rows.map(({ session, transcription }, i) => {
    const time = new Date(session.startedAt).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      id: session.id,
      title: (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-sm font-medium">{i + 1}. Diktat</span>
          <span className="truncate text-xs text-muted-foreground">
            {time} Uhr
            {session.durationMs ? ` · ${formatDuration(session.durationMs)}` : ''}
          </span>
        </span>
      ),
      description: (
        <WidgetBody
          session={session}
          transcription={transcription}
          active={openId === session.id}
        />
      ),
    };
  });

  return (
    <aside aria-label="Diktate in diesem Bericht" className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto px-3 py-4">
        <BouncyAccordion
          separated
          radius={14}
          items={items}
          value={openId}
          onValueChange={setOpenId}
          classNames={{
            item: 'border border-border shadow-sm',
            trigger: 'min-h-12 gap-2 px-4',
            title: 'text-sm font-normal',
            chevron: 'size-5',
            description: 'text-sm text-foreground',
          }}
        />
      </div>
    </aside>
  );
}

/**
 * One widget's contents. Always mounted so the card knows how tall it opens to,
 * but the recording itself is only assembled while this is the open one — a
 * dozen unplayed dictations must not sit decoded in memory behind closed cards.
 */
function WidgetBody({
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
