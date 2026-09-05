import { Pause, Play, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * The two keys that run a sitting: hold, and finish.
 *
 * Three decisions worth keeping:
 *
 * 1. The PRIMARY slot moves. While recording, finishing is the goal and pause
 *    is the aside, so pause is the quiet glass key. While paused, resuming is
 *    the goal, so it takes the dark key. The eye lands on the thing he is most
 *    likely to want next without either button ever moving position.
 *
 * 2. Finishing is red in both states, and never grows louder. It is the one
 *    irreversible control on this screen — the sitting ends, the pipeline runs
 *    — and it should read that way at a glance without shouting over a
 *    recording in progress. The house destructive is a tinted wash, not a slab.
 *
 * 3. The hold key has a floor width wide enough for "Fortsetzen", so swapping
 *    the label cannot shuffle the row underneath his hand mid-dictation. The
 *    icons crossfade in place rather than swapping, which is the difference
 *    between a state change and a flicker.
 */

export function RecordControls({
  paused,
  busy,
  stopLabel,
  onToggleHold,
  onStop,
}: {
  paused: boolean;
  busy: boolean;
  /** "Diktat beenden" / "Termin beenden" — the feature names its own ending. */
  stopLabel: string;
  onToggleHold: () => void;
  onStop: () => void;
}) {
  return (
    <div
      className={cn(
        // Stacked on a phone, side by side from sm up. Stacked, both keys take
        // the full width so their edges line up — two centred pills of
        // different widths read as ragged, which is the thing that makes a
        // careful layout look careless.
        'flex w-full flex-col items-stretch gap-3',
        'sm:w-auto sm:flex-row sm:items-center sm:justify-center',
      )}
    >
      <Button
        variant={paused ? 'default' : 'secondary'}
        size="lg"
        disabled={busy}
        onClick={onToggleHold}
        className={cn(
          'h-14 w-full rounded-full px-8 text-lg sm:w-auto sm:min-w-[12.5rem]',
          // Colour and material change with the slot; motion matches the house
          // keys, which rise on hover and settle on press.
          'transition-[background-color,color,box-shadow] duration-300 ease-out',
        )}
      >
        <span
          aria-hidden
          className="relative inline-flex size-5 shrink-0 items-center justify-center"
        >
          <Pause
            className={cn(
              'absolute size-5 transition-[opacity,transform] duration-200 ease-out',
              'motion-reduce:transition-none',
              paused ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
            )}
          />
          <Play
            className={cn(
              'absolute size-5 transition-[opacity,transform] duration-200 ease-out',
              'motion-reduce:transition-none',
              paused ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
            )}
          />
        </span>
        {paused ? 'Fortsetzen' : 'Pause'}
      </Button>

      <Button
        variant="destructive"
        size="lg"
        disabled={busy}
        onClick={onStop}
        className="h-14 w-full rounded-full px-8 text-lg sm:w-auto"
      >
        {busy ? <Spinner /> : <Square aria-hidden className="size-4 fill-current" />}
        {stopLabel}
      </Button>
    </div>
  );
}
