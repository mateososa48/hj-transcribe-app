/**
 * The FFT band mapping behind the recording indicator.
 *
 * An FFT is linear in Hz; hearing is not. Grouping the bins into even thirds of
 * the array looks like the same thing and puts virtually all of a human voice
 * into the lowest third — the indicator then barely moves while someone is
 * talking, which is the one failure mode it must not have.
 *
 *   npx tsx --test eval/bands.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { BANDS, binRange } from '../src/lib/audio/mic-level.ts';

// What MicLevelMonitor actually runs with: fftSize 1024 at 48 kHz.
const BIN_HZ = 48_000 / 1024;
const BIN_COUNT = 512;

const range = (band: readonly [number, number]) =>
  binRange(band[0], band[1], BIN_HZ, BIN_COUNT);

test('the bands cover the ranges they claim to', () => {
  const [lowFrom, lowTo] = range(BANDS.low);
  const [midFrom, midTo] = range(BANDS.mid);
  const [highFrom, highTo] = range(BANDS.high);

  // Each range must actually contain its own Hz limits.
  assert.ok(lowFrom * BIN_HZ <= 60 + BIN_HZ && lowTo * BIN_HZ >= 320);
  assert.ok(midFrom * BIN_HZ <= 320 + BIN_HZ && midTo * BIN_HZ >= 1600);
  assert.ok(highFrom * BIN_HZ <= 1600 + BIN_HZ && highTo * BIN_HZ >= 6000);
});

test('the bands are grouped by frequency, not by even thirds of the array', () => {
  const widths = [range(BANDS.low), range(BANDS.mid), range(BANDS.high)].map(
    ([from, to]) => to - from,
  );
  const even = BIN_COUNT / 3;

  // Each band must be nowhere near an equal share of the bins — the low band in
  // particular is a handful of bins, not 170.
  assert.ok(widths[0]! < even / 4, `low band ${widths[0]} bins`);
  assert.ok(widths[2]! > widths[1]!, 'high band should span more bins than mid');
  assert.ok(
    widths.every((w) => Math.abs(w - even) > 20),
    `bands look evenly split: ${widths.join(', ')}`,
  );
});

test('everything above 6 kHz is left out', () => {
  const [, highTo] = range(BANDS.high);
  // Sibilance is what the high band is for; the rest of the spectrum is mostly
  // hiss and would drag the reading toward a constant.
  assert.ok(highTo < BIN_COUNT / 2, `high band reaches bin ${highTo} of ${BIN_COUNT}`);
});

test('a degenerate or empty range is reported as empty, not as bin zero', () => {
  assert.deepEqual(binRange(1600, 6000, 0, 512), [0, 0]);
  assert.deepEqual(binRange(6000, 1600, BIN_HZ, 512), [0, 0]);
  // A range entirely above Nyquist has no bins to average.
  assert.deepEqual(binRange(40_000, 60_000, BIN_HZ, 512), [0, 0]);
});
