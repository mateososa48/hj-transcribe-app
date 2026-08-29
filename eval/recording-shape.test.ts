import assert from 'node:assert/strict';
import test from 'node:test';

import { findWordBreaks, normaliseShape } from '../src/features/session/recording-shape.ts';

test('an empty or unusable recording yields no shape at all', () => {
  assert.deepEqual(normaliseShape([]), []);
  assert.deepEqual(normaliseShape([0, 0, 0]), []);
});

test('shape is resampled to the requested number of bars, up or down', () => {
  const many = Array.from({ length: 300 }, (_, i) => 1000 + i);
  assert.equal(normaliseShape(many, 64).length, 64);
  // A short recording has fewer chunks than bars and must still fill the band.
  assert.equal(normaliseShape([1000, 5000, 2000], 64).length, 64);
});

test('values are normalised into the visible band', () => {
  const shape = normaliseShape([1000, 20000, 5000, 12000], 32);
  for (const v of shape) {
    assert.ok(v >= 0.15 && v <= 1, `bar ${v} outside the drawable range`);
  }
  assert.ok(Math.max(...shape) > Math.min(...shape), 'a varying recording must vary on screen');
});

test('a perfectly flat recording renders as a flat band rather than dividing by zero', () => {
  const shape = normaliseShape([4000, 4000, 4000, 4000], 16);
  assert.equal(shape.length, 16);
  assert.ok(shape.every((v) => v === shape[0]));
  assert.ok(Number.isFinite(shape[0]!));
});

test('upsampling interpolates instead of repeating plateaus', () => {
  const shape = normaliseShape([1000, 9000], 5);
  // Strictly rising between the two chunks, not two flat steps.
  for (let i = 1; i < shape.length; i += 1) {
    assert.ok(shape[i]! > shape[i - 1]!, 'interpolated shape should rise smoothly');
  }
});

test('word breaks do not chatter on a noisy quiet stretch', () => {
  // A quiet passage wobbling either side of the threshold: naive thresholding
  // flips every sample and renders the writing as a dotted rule.
  const noisy = Array.from({ length: 60 }, (_, i) => 0.2 + (i % 2 === 0 ? 0.05 : -0.05));
  const breaks = findWordBreaks(noisy);
  let flips = 0;
  for (let i = 1; i < breaks.length; i += 1) if (breaks[i] !== breaks[i - 1]) flips += 1;
  assert.ok(flips <= 2, `expected a steady read, got ${flips} flips`);
});

test('a real pause still opens a word space', () => {
  const speech = Array.from({ length: 40 }, () => 0.8);
  const withPause = [...speech.slice(0, 15), ...Array(8).fill(0.05), ...speech.slice(23)];
  const breaks = findWordBreaks(withPause);
  assert.ok(breaks.some(Boolean), 'a genuine silence must break the line');
  assert.equal(breaks[0], false, 'speech must not be treated as a pause');
  assert.equal(breaks[18], true, 'the middle of the silence must be a gap');
});

test('runs too short to be a word or a breath are absorbed', () => {
  const shape = [...Array(20).fill(0.9), 0.02, ...Array(20).fill(0.9)];
  const breaks = findWordBreaks(shape);
  assert.ok(!breaks.some(Boolean), 'a single quiet sample is noise, not a pause');
});
