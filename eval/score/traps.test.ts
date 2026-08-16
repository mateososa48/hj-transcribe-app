/**
 * Proves the scorer CATCHES the failures it exists to catch.
 *
 * The fixture test proves traps pass on perfect input. That is only half the
 * guarantee — a scorer that returns "passed" unconditionally would also pass
 * that test. These cases corrupt a transcript the way an ASR actually fails and
 * assert that the trap goes red.
 *
 *   npx tsx --test eval/score/traps.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Trap } from '../fixtures/types.ts';
import { scorePart, scoreTraps, wordErrorRate } from './traps.ts';

const SOURCE =
  'Aktuell bestehen keine Angina pectoris und keine Dyspnoe. ' +
  'Der Patient erhält Bisoprolol fünf Milligramm eins null null.';

const TRAPS: Trap[] = [
  { kind: 'negation', severity: 'safety', label: 'keine Angina pectoris', accept: ['keine Angina pectoris'] },
  { kind: 'drug', severity: 'safety', label: 'Bisoprolol 5 mg', accept: ['Bisoprolol fünf Milligramm'] },
  { kind: 'dosing', severity: 'safety', label: '1-0-0', accept: ['eins null null', '1-0-0'] },
];

function labelsFailing(transcript: string): string[] {
  return scoreTraps(transcript, TRAPS)
    .filter((r) => !r.passed)
    .map((r) => r.trap.label);
}

test('perfect transcript passes every trap', () => {
  assert.deepEqual(labelsFailing(SOURCE), []);
});

test('DROPPED NEGATION is caught — the single most dangerous ASR failure', () => {
  const corrupted = SOURCE.replace('keine Angina pectoris', 'Angina pectoris');
  assert.deepEqual(labelsFailing(corrupted), ['keine Angina pectoris']);
});

test('WRONG DOSE is caught (5 mg -> 50 mg)', () => {
  const corrupted = SOURCE.replace('fünf Milligramm', 'fünfzig Milligramm');
  assert.deepEqual(labelsFailing(corrupted), ['Bisoprolol 5 mg']);
});

test('MANGLED DRUG NAME is caught', () => {
  const corrupted = SOURCE.replace('Bisoprolol', 'Bisoprolone');
  assert.deepEqual(labelsFailing(corrupted), ['Bisoprolol 5 mg']);
});

test('WRONG DOSING SCHEME is caught (1-0-0 -> 1-0-1)', () => {
  const corrupted = SOURCE.replace('eins null null', 'eins null eins');
  assert.deepEqual(labelsFailing(corrupted), ['1-0-0']);
});

test('an equivalent rewording still passes (digits instead of number words)', () => {
  const reworded =
    'Aktuell bestehen keine Angina pectoris und keine Dyspnoe. ' +
    'Der Patient erhält Bisoprolol 5 mg 1-0-0.';
  assert.deepEqual(labelsFailing(reworded), []);
});

test('scorePart separates safety from style counts', () => {
  const traps: Trap[] = [
    ...TRAPS,
    { kind: 'term', severity: 'style', label: 'NYHA II', accept: ['NYHA II', 'NYHA zwei'] },
  ];
  const score = scorePart(SOURCE, SOURCE, 123, traps);
  assert.equal(score.safetyTotal, 3);
  assert.equal(score.safetyPassed, 3);
  assert.equal(score.styleTotal, 1);
  assert.equal(score.stylePassed, 0); // NYHA II is not in SOURCE
  assert.equal(score.latencyMs, 123);
});

test('WER is 0 for identical text and rises with corruption', () => {
  assert.equal(wordErrorRate(SOURCE, SOURCE), 0);
  const bad = wordErrorRate(SOURCE, 'völlig anderer Text ohne Bezug');
  assert.ok(bad > 0.5, `expected high WER, got ${bad}`);
});

test('WER ignores number-word vs digit differences', () => {
  assert.equal(wordErrorRate('LVEF fünfzig Prozent', 'LVEF 50 %'), 0);
});
