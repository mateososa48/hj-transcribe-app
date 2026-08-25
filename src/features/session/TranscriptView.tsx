import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { toast } from 'sonner';

import { PlayerBar } from '@/components/player-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { db, type Session, type Utterance } from '@/lib/db';
import { speakerDisplayName, speakerOrder } from '@/lib/speakers';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { useSessionAudio } from './use-session-audio';

function timestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SPEAKER_PRESETS = ['Arzt', 'Patient', 'Patientin', 'Angehörige/r'];

/**
 * Stable visual identity per speaker. The mark varies by fill — solid, ring,
 * half-tone, half-tone ring — not by hue, so it survives the monochrome
 * palette and color-blindness alike. Every name keeps the same text weight:
 * de-emphasizing alternate speakers read as a hierarchy that was never meant,
 * and made speakers 1 and 3 indistinguishable.
 */
const SPEAKER_DOTS = [
  'bg-foreground',
  'border-[1.5px] border-foreground bg-transparent',
  'bg-muted-foreground',
  'border-[1.5px] border-muted-foreground bg-transparent',
];

/**
 * The conversation, one block per turn — the ground truth the notes were made
 * from — with the recording docked on top. Clicking a turn's timestamp plays
 * the audio from that moment; while it plays, the spoken turn is highlighted.
 * Speaker names are editable: diarization can only ever say "Sprecher 1 said
 * this", and he is the one who knows Sprecher 1 was the patient.
 */
export function TranscriptView({
  session,
  utterances,
  text,
  onSessionChanged,
}: {
  session: Session;
  utterances: Utterance[];
  text: string;
  onSessionChanged: () => void;
}) {
  const touchSessions = useAppStore((s) => s.touchSessions);
  const speakers = speakerOrder(utterances);

  const { url, missing } = useSessionAudio(session.id);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rafRef = useRef(0);

  // Follow the voice: highlight the turn being spoken. rAF only while playing.
  // Deliberately no auto-scroll — he may be reading elsewhere in the
  // transcript, and the page must never move under his eyes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || utterances.length === 0) return;

    const locate = (ms: number): number => {
      let lo = 0;
      let hi = utterances.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (utterances[mid]!.startMs <= ms) {
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
  }, [utterances, url]);

  async function rename(speaker: string, name: string | null) {
    const next = { ...(session.speakerNames ?? {}) };
    if (name) next[speaker] = name;
    else delete next[speaker];
    await db.sessions.update(session.id, { speakerNames: next });
    onSessionChanged();
    touchSessions();
    if (name) toast.success(`Sprecher umbenannt in „${name}“.`);
  }

  function playFrom(index: number) {
    const audio = audioRef.current;
    const turn = utterances[index];
    if (!audio || !turn) return;
    audio.currentTime = turn.startMs / 1000;
    setActiveIndex(index);
    void audio.play();
  }

  const player = missing ? (
    <p className="text-muted-foreground">Zu dieser Aufnahme ist kein Ton mehr gespeichert.</p>
  ) : url ? (
    // Docked: stays reachable while he scrolls a 30-minute conversation.
    <div className="sticky top-0 z-10 bg-background pb-2">
      {/* Headless element; PlayerBar drives it, the turn sync reads it. */}
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <PlayerBar src={url} audioRef={audioRef} />
    </div>
  ) : (
    <p className="flex items-center gap-3 text-muted-foreground">
      <Spinner /> Aufnahme wird geladen …
    </p>
  );

  if (utterances.length === 0) {
    return (
      <div className="space-y-5">
        {player}
        {text.trim() ? (
          <p className="max-w-[70ch] whitespace-pre-wrap text-base leading-relaxed">{text}</p>
        ) : (
          <p className="text-muted-foreground">Kein Transkript vorhanden.</p>
        )}
      </div>
    );
  }

  const hasAudio = Boolean(url);

  return (
    <div className="space-y-5">
      {player}

      {speakers.length > 1 ? (
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          {speakers.length} Sprecher erkannt. Klicken Sie auf einen Namen, um ihn zu ändern.
          {hasAudio ? ' Über die Zeitmarke hören Sie die Stelle an.' : ''}
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {utterances.map((u, i) => {
          const name = speakerDisplayName(u.speaker, session.speakerNames, utterances);
          const speakerIndex = u.speaker ? Math.max(0, speakers.indexOf(u.speaker)) : 0;
          const dot = (
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                SPEAKER_DOTS[speakerIndex % SPEAKER_DOTS.length],
              )}
              aria-hidden
            />
          );
          return (
            <li
              key={i}
              className={cn(
                '-mx-3 grid grid-cols-[9.5rem_1fr] gap-3 rounded-lg px-3 py-2 transition-colors max-sm:grid-cols-1',
                i === activeIndex && 'bg-muted',
              )}
            >
              <div className="flex items-start max-sm:items-center">
                {u.speaker ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          className="-mt-1 -ml-2 h-9 gap-2 px-2 text-base font-semibold"
                        >
                          {dot}
                          {name}
                          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start">
                      {SPEAKER_PRESETS.map((preset) => (
                        <DropdownMenuItem key={preset} onClick={() => void rename(u.speaker!, preset)}>
                          {preset}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void rename(u.speaker!, null)}>
                        Zurücksetzen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="flex items-center gap-2 text-base font-semibold">
                    {dot}
                    {name}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="max-w-[62ch] text-base leading-relaxed">{u.text}</p>
                {hasAudio ? (
                  <Button
                    variant="ghost"
                    className="-ml-2 h-8 gap-1.5 px-2 text-sm font-normal tabular-nums text-muted-foreground"
                    onClick={() => playFrom(i)}
                  >
                    <Play className="size-3.5" aria-hidden />
                    {timestamp(u.startMs)}
                  </Button>
                ) : (
                  <p className="text-sm tabular-nums text-muted-foreground">{timestamp(u.startMs)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
