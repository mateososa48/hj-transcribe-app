/**
 * MM:SS for a recording.
 *
 * In its own module, free of browser-only imports, so it can be tested in Node
 * — the rest of the recording stack reaches `import.meta.env` on load.
 *
 * Two bugs this exists to prevent:
 *
 * 1. Reported 2026-08-23: while stopped, elapsed was measured against the wall
 *    clock. Leaving the screen and coming back remounted the hook, re-read
 *    Date.now(), and displayed however long he had been away as recorded time —
 *    a two-minute dictation could come back reading 09:41.
 *
 * 2. Pause. The clock shows CAPTURED time, not time since the button was
 *    pressed, so a sitting paused for ten minutes does not gain ten minutes.
 *    While paused the clock freezes against `frozenAt`; `pausedMs` covers the
 *    pauses that have already closed.
 */
export function formatElapsed(
  startedAt: number | null,
  /** endedAt when stopped, pausedAt while paused, otherwise null. */
  frozenAt: number | null,
  now: number,
  running: boolean,
  pausedMs = 0,
): string {
  if (!startedAt) return '00:00';
  const until = running ? now : (frozenAt ?? now);
  const total = Math.max(0, Math.floor((until - startedAt - pausedMs) / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
