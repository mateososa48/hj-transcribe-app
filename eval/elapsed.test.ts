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
