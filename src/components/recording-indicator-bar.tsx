import type { RecordingStatus } from '@/lib/session/recording-session';
import { cn } from '@/lib/utils';

/**
 * The recording, following him everywhere.
 *
 * Until now the only sign that the microphone was open — and the only way to
 * close it — lived on the recorder screen. One click into the sidebar and the
 * app looked identical whether or not it was listening, which is how a
 * consultation gets orphaned: he walks away believing he stopped, and the
 * session is still running.
 *
 * So this strip sits above every view at every width. It says the recording is
 * running, how long it has been running, and ends it from wherever he is.
 */

/**
 * Whether the strip is on screen. Pure, so the rule can be tested without a
 * browser.
 *
 * `stopping` keeps it visible: the stop is asynchronous (the recorder flushes
 * its last chunk and the session row is written), and vanishing at the click
 * would claim the recording was over before it was.
 */
export function isRecordingVisible(status: RecordingStatus): boolean {
  return status === 'recording' || status === 'stopping';
}

/**
 * The strip itself, taking everything as props.
 *
 * It lives apart from its container because everything the container touches —
 * the store, the recorder singleton, the API config behind it — needs a
 * browser to import at all. Separated, the part that carries the safety
 * property can be rendered and asserted on in a plain node test.
 */
export function RecordingIndicatorBar({
  elapsed,
  stopping,
  onOpen,
  onStop,
}: {
  elapsed: string;
  stopping: boolean;
  /** Back to the recorder screen. Safe mid-session: reset() refuses to run
   *  while the recorder is live (recording-session.ts:114). */
  onOpen: () => void;
  onStop: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Aufnahme läuft seit ${elapsed}`}
      data-testid="recording-indicator"
      className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6"
    >
      {/* The strip itself returns him to the recorder; the key ends the
          sitting. Two different things to want, two different targets. */}
      <button
        type="button"
        onClick={onOpen}
        className="-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        {/* The one red thing in the app. It means exactly one condition. */}
        <span className="relative flex size-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-red-600" />
        </span>
        <span className="text-sm font-medium">Aufnahme läuft</span>
        <span className="text-sm text-muted-foreground tabular-nums">{elapsed}</span>
      </button>

      <button
        type="button"
        onClick={onStop}
        disabled={stopping}
        className={cn(
          'btn-gloss ms-auto flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground',
          'disabled:pointer-events-none disabled:opacity-60',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {stopping ? 'Wird beendet …' : 'Aufnahme beenden'}
      </button>
    </div>
  );
}

