import type { Trap } from '../fixtures/types.ts';
import { normalizeGerman } from './normalize.ts';

export interface TrapResult {
  trap: Trap;
  passed: boolean;
  /** Which accept-form matched, for the report. */
  matched?: string;
}

export interface PartScore {
  transcript: string;
  latencyMs: number;
  results: TrapResult[];
  safetyTotal: number;
  safetyPassed: number;
  styleTotal: number;
  stylePassed: number;
  /** Word error rate vs the fixture script. Secondary signal, not a gate. */
  wer: number;
}

/**
 * A trap passes if ANY of its accept-forms appears in the transcript after
 * German normalisation. Substring matching is intentional: the transcript is
 * continuous prose and we are asking "did this fact survive?", not "is the
 * wording identical?".
 */
export function scoreTraps(transcript: string, traps: Trap[]): TrapResult[] {
  const haystack = normalizeGerman(transcript);
  return traps.map((trap) => {
    const matched = trap.accept.find((form) => haystack.includes(normalizeGerman(form)));
    return matched === undefined ? { trap, passed: false } : { trap, passed: true, matched };
  });
}

/** Token-level Levenshtein, used for WER. */
function editDistance(a: string[], b: string[]): number {
  // Two-row DP: the full matrix is unnecessary and these can be long.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/**
 * Word error rate against the fixture script, computed on normalised tokens so
 * that "48 mm" vs "achtundvierzig Millimeter" is not counted as an error.
 *
 * This is context, NOT the gate. A provider can have a respectable WER while
 * dropping exactly the one "keine" that matters — which is the entire reason
 * the trap set exists.
 */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = normalizeGerman(reference).split(' ').filter(Boolean);
  const hyp = normalizeGerman(hypothesis).split(' ').filter(Boolean);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  return editDistance(ref, hyp) / ref.length;
}

export function scorePart(
  reference: string,
  transcript: string,
  latencyMs: number,
  traps: Trap[],
): PartScore {
  const results = scoreTraps(transcript, traps);
  const safety = results.filter((r) => r.trap.severity === 'safety');
  const style = results.filter((r) => r.trap.severity === 'style');

  return {
    transcript,
    latencyMs,
    results,
    safetyTotal: safety.length,
    safetyPassed: safety.filter((r) => r.passed).length,
    styleTotal: style.length,
    stylePassed: style.filter((r) => r.passed).length,
    wer: wordErrorRate(reference, transcript),
  };
}
