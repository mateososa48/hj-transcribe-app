/**
 * Tests for the German normaliser.
 *
 * This runs offline and must stay green — every trap score in the eval depends
 * on it. A bug here silently mis-scores every provider, which is worse than a
 * failing eval because it looks like a result.
 *
 *   npx tsx --test eval/score/normalize.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeGerman as n } from './normalize.ts';

const cases: Array<[input: string, expected: string]> = [
  // Number words vs digits — the core equivalence.
  ['LVEDD achtundvierzig Millimeter', 'lvedd 48mm'],
  ['LVEDD 48 mm', 'lvedd 48mm'],
  ['LVEF fünfzig Prozent', 'lvef 50%'],
  ['LVEF 50 %', 'lvef 50%'],
  ['sechzehn', '16'],
  ['siebenundsiebzig', '77'],
  ['zweihundertfünfzig Meter', '250m'],

  // Decimal comma — spoken, German, and Anglo forms all converge.
  ['vier Komma sieben Zentimeter', '4,7cm'],
  ['4,7 cm', '4,7cm'],
  ['4.7 cm', '4,7cm'],

  // Years (needed for date traps; exceeds the 0-999 range).
  ['März zweitausendfünfundzwanzig', 'märz 2025'],
  ['zweitausendsechsundzwanzig', '2026'],

  // Drugs and dosing.
  ['Bisoprolol fünf Milligramm', 'bisoprolol 5mg'],
  ['1 - 0 - 0', '1-0-0'],
  ['einundfünfzig Milligramm pro Deziliter', '51mg/dl'],

  // Negations must survive verbatim (SPEC constraint: "keine" never lost).
  ['keine Angina pectoris.', 'keine angina pectoris'],
  ['Keine Blutungskomplikationen!', 'keine blutungskomplikationen'],

  // Abbreviation periods survive sentence-period stripping.
  ['Z.n. NSTEMI', 'z.n. nstemi'],
  ['V.a. Myokarditis.', 'v.a. myokarditis'],

  // Blood pressure.
  ['Blutdruck 140/90 mmHg', 'blutdruck 140/90mmhg'],
  ['einhundertvierzig zu neunzig', '140 zu 90'],
];

for (const [input, expected] of cases) {
  test(`normalize: ${input}`, () => {
    assert.equal(n(input), expected);
  });
}

test('normalisation is idempotent', () => {
  for (const [input] of cases) {
    assert.equal(n(n(input)), n(input), `not idempotent: ${input}`);
  }
});

test('a dropped negation does not accidentally match', () => {
  // The single most dangerous ASR failure for this app.
  assert.ok(!n('Angina pectoris').includes(n('keine Angina pectoris')));
});
