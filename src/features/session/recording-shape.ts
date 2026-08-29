import { db } from '@/lib/db';

/**
 * The outline of a recording, cheaply.
 *
 * Audio is stored as ~5-second Opus chunks, and Opus is variable-bitrate: a
 * chunk of animated speech carries more bytes than a chunk of a pause. So the
 * sequence of stored chunk SIZES is already a real, if coarse, profile of how
 * this particular recording sounded — available for the price of a key scan,
 * where decoding the audio to draw a true waveform would cost seconds of CPU
 * and tens of megabytes on the machine this has to run on.
 *
 * It is used only to give the processing screen a shape that belongs to his
 * recording rather than one invented by a designer. Nothing is claimed of it
 * beyond that, and it is never labelled to the user as a waveform.
 */

/** Bars in the processing band. Fine enough to read as a signal, not as a bar chart. */
export const SHAPE_RESOLUTION = 128;

/**
 * Resample raw chunk sizes to `bars` values in 0..1.
 *
 * Normalised against the recording's own range, so a quiet dictation and a
 * loud consultation both fill the band; the floor keeps near-silent stretches
 * visible as a low ripple instead of a dead gap.
 */
export function normaliseShape(sizes: readonly number[], bars = SHAPE_RESOLUTION): number[] {
  const usable = sizes.filter((n) => Number.isFinite(n) && n > 0);
  if (usable.length === 0) return [];

  const out: number[] = [];
  if (usable.length >= bars) {
    // More chunks than bars: average each bar's span so nothing is dropped.
    for (let i = 0; i < bars; i += 1) {
      const from = Math.floor((i * usable.length) / bars);
      const to = Math.max(from + 1, Math.floor(((i + 1) * usable.length) / bars));
      let sum = 0;
      for (let j = from; j < to && j < usable.length; j += 1) sum += usable[j]!;
      out.push(sum / (to - from));
    }
  } else {
    // Fewer chunks than bars — a short recording. Interpolate between them,
    // otherwise each chunk becomes a flat plateau and the band looks blocky.
    for (let i = 0; i < bars; i += 1) {
      const at = (i * (usable.length - 1)) / Math.max(1, bars - 1);
      const lo = Math.floor(at);
      const hi = Math.min(usable.length - 1, lo + 1);
      const t = at - lo;
      out.push(usable[lo]! * (1 - t) + usable[hi]! * t);
    }
  }

  const min = Math.min(...out);
  const max = Math.max(...out);
  if (max <= min) return out.map(() => 0.6);
  return out.map((v) => 0.15 + ((v - min) / (max - min)) * 0.85);
}

/** Chunk sizes for one session, in recorded order. Blobs are not read. */
export async function loadRecordingShape(sessionId: string): Promise<number[]> {
  const chunks = await db.chunks
    .where('[sessionId+index]')
    .between([sessionId, 0], [sessionId, Infinity])
    .toArray();
  chunks.sort((a, b) => a.index - b.index);
  // `.size` is metadata on the Blob handle — the bytes stay in IndexedDB.
  return normaliseShape(chunks.map((c) => c.blob?.size ?? 0));
}

/**
 * Where the writing breaks for a word space.
 *
 * Thresholding the outline directly does not work: in a quiet stretch the
 * value wobbles either side of the threshold and flips on and off sample by
 * sample, which renders as a dotted rule instead of words. So the signal is
 * smoothed, crossed with hysteresis rather than a single threshold, and any
 * run too short to be a word or a breath is absorbed into its neighbour.
 */
const PAUSE_ENTER = 0.17;
const PAUSE_EXIT = 0.26;
/** Shorter than this is chunk-to-chunk noise, not a word or a pause. */
const MIN_RUN = 3;

export function findWordBreaks(shape: readonly number[]): boolean[] {
  const n = shape.length;
  if (n === 0) return [];

  const smooth = shape.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = i - 2; k <= i + 2; k += 1) {
      const v = shape[Math.min(n - 1, Math.max(0, k))];
      if (v !== undefined) {
        sum += v;
        count += 1;
      }
    }
    return sum / count;
  });

  const quiet: boolean[] = [];
  let state = false;
  for (let i = 0; i < n; i += 1) {
    const v = smooth[i] ?? 0;
    if (state ? v > PAUSE_EXIT : v < PAUSE_ENTER) state = !state;
    quiet.push(state);
  }

  return absorbShortRuns(quiet, MIN_RUN);
}

/** Flips runs shorter than `min` to match what precedes them. */
function absorbShortRuns(values: boolean[], min: number): boolean[] {
  const out = [...values];
  let start = 0;
  for (let i = 1; i <= out.length; i += 1) {
    if (i < out.length && out[i] === out[start]) continue;
    if (i - start < min && start > 0) {
      const fill = out[start - 1] ?? false;
      for (let k = start; k < i; k += 1) out[k] = fill;
    }
    start = i;
  }
  return out;
}
