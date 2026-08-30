import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Pause, Play } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The slim player, for a recording sitting inside a widget.
 *
 * PlayerBar is the instrument: a 44px round key, ten-seconds-back, a speed
 * control, two clocks. That is right on the Diktat page, where re-listening IS
 * the task, and far too much furniture for a card beside a letter — it made
 * the widget as tall as the thing it belongs to.
 *
 * This is one line: a small key that swaps to a pause bar, a hairline he can
 * drag, and the position. Everything else lives on the Diktat page.
 */

function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const total = Math.floor(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function MiniPlayer({
  audioRef,
  /** Known duration in seconds, until the element reports a finite one. */
  fallbackDuration,
  className,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  fallbackDuration?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // MediaRecorder WebM reports Infinity until seeked once — the standard fix,
    // the same one PlayerBar carries.
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

    audio.addEventListener('loadedmetadata', fixDuration);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('ended', onPause);
    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener('loadedmetadata', fixDuration);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onPause);
    };
  }, [audioRef]);

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

  const progress = duration > 0 ? Math.min(current / duration, 1) : 0;

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* The glyph itself is the control — no disc behind it, nothing that
          moves when pressed. It is still 40px of target around 16px of ink,
          which is the size everything he uses routinely has to meet. */}
      <button
        type="button"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (audio.paused) void audio.play();
          else audio.pause();
        }}
        aria-label={playing ? 'Pause' : 'Abspielen'}
        className="relative grid size-5 shrink-0 place-items-center text-foreground after:absolute after:-inset-2.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {playing ? (
          <Pause className="size-4 fill-current" aria-hidden />
        ) : (
          <Play className="size-4 fill-current" aria-hidden />
        )}
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Wiedergabeposition"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${clock(current)} von ${clock(duration)}`}
        className="group relative flex h-6 min-w-0 flex-1 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onPointerDown={(e) => {
          seekFromPointer(e.clientX);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* drag still works via pointermove while pressed */
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
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${progress * 100}%` }} />
        </div>
        <div
          className="absolute size-2.5 -translate-x-1/2 rounded-full bg-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ left: `${progress * 100}%` }}
          aria-hidden
        />
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {clock(current)} / {clock(duration)}
      </span>
    </div>
  );
}
