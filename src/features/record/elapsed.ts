/**
 * MM:SS for a recording.
 *
 * In its own module, free of browser-only imports, so it can be tested in Node
 * — the rest of the recording stack reaches `import.meta.env` on load.
 *
 * The bug this exists to prevent, reported 2026-08-23: while stopped, the
 * elapsed time was measured against the wall clock. Leaving the screen and
 * coming back remounted the hook, re-read Date.now(), and displayed however
 * long he had been away as recorded time — a two-minute dictation could come
 * back reading 09:41.
 */
export function formatElapsed(
  startedAt: number | null,
  endedAt: number | null,
  now: number,
  running: boolean,
): string {
  if (!startedAt) return '00:00';
  const until = running ? now : (endedAt ?? now);
  const total = Math.max(0, Math.floor((until - startedAt) / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
