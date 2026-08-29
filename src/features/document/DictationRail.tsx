import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { PlayerBar } from '@/components/player-bar';
import { formatDuration } from '@/features/sessions/useSessions';
import { useSessionAudio } from '@/features/session/use-session-audio';
import { db, type Session, type Transcription } from '@/lib/db';
import { cn } from '@/lib/utils';

/**
 * The dictations recorded into this Bericht, as a narrow column beside the
 * page rather than a slab beneath it. The letter is the work; the recordings
 * are the source he checks against — within reach, never in the way.
 *
 * Deliberately slim: a row is a line of text he can scan, and opening one
 * gives him only what checking needs — the audio and the words that came out
 * of it.
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

  return (
    <aside
      aria-label="Diktate in diesem Bericht"
      className="hidden w-72 shrink-0 border-s border-border bg-card lg:block"
    >
      <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto">
        <h2 className="px-4 pt-4 pb-2 text-sm font-semibold tracking-tight text-muted-foreground">
          Diktate in diesem Bericht
        </h2>
        <ul>
          {rows.map(({ session, transcription }, i) => (
            <RailItem
              key={session.id}
              index={i}
              session={session}
              transcription={transcription}
              open={openId === session.id}
              onToggle={() => setOpenId(openId === session.id ? null : session.id)}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}

function RailItem({
  index,
  session,
  transcription,
  open,
  onToggle,
}: {
  index: number;
  session: Session;
  transcription: Transcription | null;
  open: boolean;
  onToggle: () => void;
}) {
  const time = new Date(session.startedAt).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{index + 1}. Diktat</span>
          <span className="text-muted-foreground">
            {' · '}
            {time} Uhr
            {session.durationMs ? ` · ${formatDuration(session.durationMs)}` : ''}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {open ? <RailPlayback session={session} transcription={transcription} /> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Playback for one row. The transcript follows the voice as it plays, the same
 * evidence the Diktat page shows — sized for a column instead of a panel, and
 * mounted only while the row is open so a closed rail costs nothing.
 */
function RailPlayback({
  session,
  transcription,
}: {
  session: Session;
  transcription: Transcription | null;
}) {
  const { url, missing } = useSessionAudio(session.id);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const words = transcription?.words ?? [];

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
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (missing) {
    return (
      <p className="px-4 pb-3 text-sm text-muted-foreground">
        Zu dieser Aufnahme ist kein Ton mehr gespeichert.
      </p>
    );
  }
  if (!url) return <p className="px-4 pb-3 text-sm text-muted-foreground">Wird geladen …</p>;

  return (
    <div className="pb-3">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <PlayerBar
        src={url}
        audioRef={audioRef}
        className="rounded-none border-0 bg-transparent px-4 py-2"
      />
      {words.length > 0 ? (
        <div className="max-h-56 overflow-y-auto px-4">
          <p className="text-sm leading-relaxed">
            {words.map((word, i) => (
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
        </div>
      ) : transcription?.text.trim() ? (
        <p className="max-h-56 overflow-y-auto px-4 text-sm leading-relaxed text-muted-foreground">
          {transcription.text}
        </p>
      ) : null}
    </div>
  );
}
