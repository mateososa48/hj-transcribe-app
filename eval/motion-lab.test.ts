import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LAB_STAGES,
  getLabStage,
  getMotionClassName,
  nextPlaybackSpeed,
} from '../src/motion-lab/model.ts';

test('stage timeline clamps out-of-range progress and advances through all processing phases', () => {
  assert.equal(getLabStage(-1).id, 'secured');
  assert.equal(getLabStage(0.39).id, 'transcribing');
  assert.equal(getLabStage(0.75).id, 'drafting');
  assert.equal(getLabStage(0.98).id, 'done');
  assert.equal(getLabStage(3).id, 'done');
  assert.equal(LAB_STAGES.length, 4);
});

test('playback speed cycles through the supported comparison rates', () => {
  assert.equal(nextPlaybackSpeed(0.5), 1);
  assert.equal(nextPlaybackSpeed(1), 2);
  assert.equal(nextPlaybackSpeed(2), 0.5);
});

test('motion classes expose paused, speed, and reduced-motion states independently', () => {
  assert.equal(getMotionClassName({ paused: false, speed: 1, reduced: false }), 'speed-1');
  assert.equal(
    getMotionClassName({ paused: true, speed: 0.5, reduced: true }),
    'speed-05 is-paused is-reduced',
  );
});
