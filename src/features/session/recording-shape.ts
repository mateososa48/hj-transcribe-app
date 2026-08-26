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

/** Bars in the processing band. Enough to read as a signal, few enough to lay out cheaply. */
export const SHAPE_RESOLUTION = 64;

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
  for (let i = 0; i < bars; i += 1) {
    const from = Math.floor((i * usable.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * usable.length) / bars));
    let sum = 0;
    for (let j = from; j < to && j < usable.length; j += 1) sum += usable[j]!;
    out.push(sum / (to - from));
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
