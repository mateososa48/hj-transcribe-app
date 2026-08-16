/**
 * Segment rotation logic.
 *
 * This is the algorithm the "unlosable recording" guarantee rests on, so it is
 * tested directly rather than only observed in a browser. The browser can tell
 * you it worked once; these tell you it works at the boundaries.
 *
 *   npx tsx --test eval/recorder.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ROTATION_DEFAULTS as D,
  decideRotation,
  type RotationDecision,
} from '../src/lib/audio/recorder.ts';

const decide = (elapsedMs: number, silentForMs: number): RotationDecision =>
  decideRotation({ elapsedMs, silentForMs }, D);

test('does not rotate before the target, even during a long silence', () => {
  // Pausing to think at 20 s must not end the segment.
  assert.equal(decide(20_000, 5_000), 'continue');
  assert.equal(decide(D.targetSegmentMs - 1, 10_000), 'continue');
});

test('does not rotate at the target while speech is continuous', () => {
  assert.equal(decide(D.targetSegmentMs, 0), 'continue');
  assert.equal(decide(D.targetSegmentMs + 5_000, 0), 'continue');
  // A silence shorter than the hold window is a pause between words, not a gap.
  assert.equal(decide(D.targetSegmentMs + 5_000, D.silenceHoldMs - 1), 'continue');
});

test('rotates at the target once a real silence window appears', () => {
  assert.equal(decide(D.targetSegmentMs, D.silenceHoldMs), 'rotate-quiet');
  assert.equal(decide(D.targetSegmentMs + 3_000, D.silenceHoldMs + 500), 'rotate-quiet');
});

test('forces rotation at the hard cap regardless of speech', () => {
  // The runaway case: he never stops talking. Cut anyway.
  assert.equal(decide(D.maxSegmentMs, 0), 'rotate-forced');
  assert.equal(decide(D.maxSegmentMs + 10_000, 0), 'rotate-forced');
});

test('the hard cap outranks the quiet path', () => {
  assert.equal(decide(D.maxSegmentMs, D.silenceHoldMs), 'rotate-forced');
});

test('a segment can never exceed the hard cap', () => {
  // Walk a full minute of continuous speech at the real poll interval and
  // assert the recorder always rotates by maxSegmentMs.
  let rotatedAt: number | null = null;
  for (let t = 0; t <= 120_000; t += 250) {
    if (decide(t, 0) !== 'continue') {
      rotatedAt = t;
      break;
    }
  }
  assert.notEqual(rotatedAt, null);
  assert.ok(
    rotatedAt! <= D.maxSegmentMs + 250,
    `segment ran to ${rotatedAt}ms, past the ${D.maxSegmentMs}ms cap`,
  );
});

test('typical dictation rotates in a gap, not at the cap', () => {
  // Simulated: speech with a ~600 ms pause every ~10 s. Rotation should land on
  // one of those pauses shortly after the target, well before the hard cap.
  const silentAt = (t: number) => (t % 10_000 >= 9_400 ? (t % 10_000) - 9_400 : 0);

  let decision: RotationDecision = 'continue';
  let at = 0;
  for (let t = 0; t <= 120_000; t += 250) {
    decision = decide(t, silentAt(t));
    if (decision !== 'continue') {
      at = t;
      break;
    }
  }
  assert.equal(decision, 'rotate-quiet', 'should have found a gap rather than hitting the cap');
  assert.ok(at >= D.targetSegmentMs, `rotated too early at ${at}ms`);
  assert.ok(at < D.maxSegmentMs, `rotated at the cap (${at}ms) instead of in a gap`);
});

test('defaults are sane relative to each other', () => {
  assert.ok(D.targetSegmentMs < D.maxSegmentMs, 'target must be below the hard cap');
  assert.ok(D.overlapMs > 0, 'overlap must be positive or audio is lost at boundaries');
  assert.ok(
    D.overlapMs < D.silenceHoldMs * 2,
    'overlap should fit comfortably inside a typical silence window',
  );
  assert.ok(D.deadInputMs > D.maxSegmentMs / 8, 'dead-input alarm must not fire on normal pauses');
});
