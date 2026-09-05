/**
 * The recording timer.
 *
 * Reported 2026-08-23: "I stopped it, then I leave and come back and the time
 * advanced." The elapsed time was measured against the wall clock even after
 * stopping, so remounting the screen re-read Date.now() and displayed the time
 * spent on another screen as recorded time.
 *
 *   npx tsx --test eval/elapsed.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatElapsed } from '../src/features/record/elapsed.ts';

const START = 1_000_000_000_000;
const s = (n: number) => START + n * 1000;

test('counts up while recording', () => {
  assert.equal(formatElapsed(START, null, s(0), true), '00:00');
  assert.equal(formatElapsed(START, null, s(9), true), '00:09');
  assert.equal(formatElapsed(START, null, s(75), true), '01:15');
  assert.equal(formatElapsed(START, null, s(3599), true), '59:59');
});

test('freezes at the moment it was stopped', () => {
  const ended = s(125);
  assert.equal(formatElapsed(START, ended, ended, false), '02:05');
});

test('does NOT advance while he is on another screen', () => {
  const ended = s(125);
  // He stops at 02:05, spends seven minutes reading the draft, comes back.
  const muchLater = s(125 + 7 * 60);
  assert.equal(
    formatElapsed(START, ended, muchLater, false),
    '02:05',
    'the timer absorbed the time he was away',
  );
});

test('a fresh screen with no recording shows zero', () => {
  assert.equal(formatElapsed(null, null, s(500), false), '00:00');
  assert.equal(formatElapsed(null, null, s(500), true), '00:00');
});

test('never renders a negative time if the clock jumps backwards', () => {
  assert.equal(formatElapsed(START, null, START - 5000, true), '00:00');
});

test('falls back to now when a stopped session has no end time', () => {
  // Sessions recorded before endedAt existed. Better an approximate number than
  // a crash or a blank.
  assert.equal(formatElapsed(START, null, s(30), false), '00:30');
});

// ------------------------------------------------------------------ pause ---
//
// The clock shows CAPTURED time. A sitting paused for ten minutes must not gain
// ten minutes — that would be wrong on screen, wrong in Session.durationMs, and
// wrong in anything derived from duration.

test('while paused the clock freezes at the moment of pausing', () => {
  // Started at 0, ran 30 s, paused at 30 s. Two minutes later it still says 30.
  const pausedAt = s(30);
  assert.equal(formatElapsed(START, pausedAt, s(150), false, 0), '00:30');
});

test('after resuming, paused time is excluded', () => {
  // Ran 30 s, paused 120 s, then running again at wall-clock 200 s.
  // Captured = 200 - 120 = 80 s.
  assert.equal(formatElapsed(START, null, s(200), true, 120_000), '01:20');
});

test('several pauses accumulate', () => {
  // Two pauses totalling 90 s, wall clock at 300 s -> 210 s captured.
  assert.equal(formatElapsed(START, null, s(300), true, 90_000), '03:30');
});

test('a session stopped from paused reports captured time, not wall time', () => {
  // Wall clock 300 s, of which 200 s were paused.
  assert.equal(formatElapsed(START, s(300), s(999), false, 200_000), '01:40');
});

test('pause never renders a negative time', () => {
  // Defensive: pausedMs larger than the whole span cannot underflow the clock.
  assert.equal(formatElapsed(START, null, s(10), true, 60_000), '00:00');
});

test('zero paused time behaves exactly as before', () => {
  assert.equal(formatElapsed(START, null, s(65), true, 0), '01:05');
  assert.equal(formatElapsed(START, null, s(65), true), '01:05');
});
