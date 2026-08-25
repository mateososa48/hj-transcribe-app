import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The app's own audio player — the native <audio controls> chrome looked like
 * a foreign object on the page.
 *
 * Three controls a doctor re-listening to a consultation actually uses:
 * play/pause, a scrubbable timeline, and "10 Sekunden zurück" for the number
 * he half-heard. Plus playback speed for long appointments. Nothing else.
 *
 * The <audio> element itself is headless here; callers that need it (the
 * follow-along transcript syncs to currentTime) pass their own ref.
 */

/** MM:SS from seconds. */
function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const total = Math.floor(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const RATES = [1, 1.25, 1.5, 2];

export function PlayerBar({
  src,
  audioRef: externalRef,
  /** Known duration in seconds, used until the element reports a finite one. */
  fallbackDuration,
}: {
  src: string;
  audioRef?: RefObject<HTMLAudioElement | null>;
  fallbackDuration?: number;
}) {
  const internalRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = externalRef ?? internalRef;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration ?? 0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // MediaRecorder WebM reports Infinity until seeked once — the standard fix.
    const fixDuration = () => {
      if (audio.duration === Infinity) {
        const restore = () => {
          audio.currentTime = 0;
          audio.removeEventListener('seeked', restore);
        };
        audio.addEventListener('seeked', restore);
        audio.currentTime = Number.MAX_SAFE_INTEGER;
        return;
      }
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(rafRef.current);
      const tick = () => {
        setCurrent(audio.currentTime);
        if (!audio.paused) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      setCurrent(audio.currentTime);
    };
    const onSeeked = () => setCurrent(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    audio.addEventListener('loadedmetadata', fixDuration);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('ended', onEnded);
    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener('loadedmetadata', fixDuration);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioRef, src]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const max = Number.isFinite(audio.duration) ? audio.duration : duration;
      audio.currentTime = Math.min(Math.max(seconds, 0), Math.max(max - 0.05, 0));
      setCurrent(audio.currentTime);
    },
    [audioRef, duration],
  );

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      seekTo(ratio * duration);
    },
    [duration, seekTo],
  );

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const cycleRate = () => {
    const audio = audioRef.current;
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    setRate(next);
    if (audio) audio.playbackRate = next;
  };

  const progress = duration > 0 ? Math.min(current / duration, 1) : 0;

  return (
    // On narrow screens the timeline takes its own full row — squeezed between
    // the time labels it degrades to an unscrubbable sliver.
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3.5">
      {externalRef ? null : <audio ref={internalRef} src={src} preload="metadata" />}

      <Button
        size="icon-lg"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Abspielen'}
        className="size-11 shrink-0 rounded-full"
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="ml-0.5 size-5" aria-hidden />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => seekTo(current - 10)}
        aria-label="10 Sekunden zurück"
        className="relative shrink-0 text-muted-foreground"
      >
        <RotateCcw className="size-5" aria-hidden />
        <span className="absolute inset-0 grid place-items-center pt-px text-[0.5rem] font-bold" aria-hidden>
          10
        </span>
      </Button>

      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {clock(current)}
      </span>

      {/* The timeline. A div, not <input type=range> — the range thumb cannot
          be styled consistently, and this needs drag, click and keyboard. */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Wiedergabeposition"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${clock(current)} von ${clock(duration)}`}
        className="group relative order-last flex h-8 min-w-0 flex-1 basis-full cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:order-none sm:basis-auto"
        onPointerDown={(e) => {
          // Seek first, capture second: capture can throw (NotFoundError on
          // some inputs) and must never eat the click itself.
          seekFromPointer(e.clientX);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* drag will still work via pointermove while pressed */
          }
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seekTo(current + 5);
          if (e.key === 'ArrowLeft') seekTo(current - 5);
        }}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${progress * 100}%` }} />
        </div>
        <div
          className={cn(
            'absolute size-3.5 -translate-x-1/2 rounded-full bg-foreground shadow-sm transition-transform',
            'group-hover:scale-110 group-focus-visible:scale-110',
          )}
          style={{ left: `${progress * 100}%` }}
          aria-hidden
        />
      </div>

      <span className="w-10 shrink-0 text-sm tabular-nums text-muted-foreground">
        {clock(duration)}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={cycleRate}
        aria-label={`Wiedergabegeschwindigkeit, aktuell ${rate}fach`}
        className="w-12 shrink-0 tabular-nums text-muted-foreground"
      >
        {rate}×
      </Button>
    </div>
  );
}
