/**
 * Transcript repairs.
 *
 * The dosing repair is the safety-critical one: left alone, "Bisoprolol 5 mg
 * 100" reads as a 100 mg dose. These tests pin BOTH directions — that the
 * repair fires on a real scheme, and that it never fires on a strength, a
 * measurement, a year or a blood pressure.
 *
 *   npx tsx --test eval/repair.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  repairCombinationDoses,
  repairDosingSchemes,
  repairPressureUnits,
  repairTranscript,
} from '../src/lib/transcription/repair.ts';

// ------------------------------------------------------------- fires on ----

test('repairs a three-slot scheme after a dose', () => {
  assert.equal(
    repairDosingSchemes('Bisoprolol 5 mg 100 sowie Atorvastatin 80 mg 001.'),
    'Bisoprolol 5 mg 1-0-0 sowie Atorvastatin 80 mg 0-0-1.',
  );
});

test('repairs schemes with a decimal dose', () => {
  assert.equal(repairDosingSchemes('Bisoprolol 7,5 mg 100'), 'Bisoprolol 7,5 mg 1-0-0');
});

test('repairs every scheme in a sentence', () => {
  const got = repairDosingSchemes('Candesartan 16 mg 100, Amlodipin 5 mg 001, Torasemid 10 mg 010');
  assert.equal(got, 'Candesartan 16 mg 1-0-0, Amlodipin 5 mg 0-0-1, Torasemid 10 mg 0-1-0');
});

test('repairs a four-slot scheme', () => {
  assert.equal(repairDosingSchemes('Marcumar 3 mg 1010'), 'Marcumar 3 mg 1-0-1-0');
});

// --------------------------------------------------------- never fires on --

test('leaves a drug strength alone when there is no unit before it', () => {
  // "ASS 100" is a strength, not a scheme. This is the dangerous false positive.
  assert.equal(repairDosingSchemes('ASS 100 und Clopidogrel 75'), 'ASS 100 und Clopidogrel 75');
});

test('leaves ordinary measurements alone', () => {
  const samples = [
    'LVEF 55 %, LVEDD 52 mm',
    'Blutdruck 128/78 mmHg',
    'Gehstrecke 200 m',
    'NT-proBNP 840',
    'im März 2025',
    'LDL 101 mg/dl',
  ];
  for (const s of samples) assert.equal(repairDosingSchemes(s), s, `mangled: ${s}`);
});

test('does not touch a number that only looks like a scheme', () => {
  // 110 mg is a dose, not "1-1-0" — the triple must FOLLOW a unit, not precede one.
  assert.equal(repairDosingSchemes('Dabigatran 110 mg'), 'Dabigatran 110 mg');
});

test('does not fire when the triple is part of a longer number', () => {
  assert.equal(repairDosingSchemes('Ferritin 10 mg 1001x'), 'Ferritin 10 mg 1001x');
});

// -------------------------------------------------------------- pressure ---

test('canonicalises half-abbreviated pressure units', () => {
  assert.equal(
    repairPressureUnits('maximaler Gradient 48 mm Quecksilbersäule'),
    'maximaler Gradient 48 mmHg',
  );
  assert.equal(
    repairPressureUnits('Druck 38 Millimeter Quecksilbersäule'),
    'Druck 38 mmHg',
  );
});

test('leaves a genuine length in mm alone', () => {
  assert.equal(repairPressureUnits('LVEDD 52 mm im Verlauf'), 'LVEDD 52 mm im Verlauf');
});

// ---------------------------------------------------------- combinations ---

test('restores the slash in a combination-product strength', () => {
  assert.equal(
    repairCombinationDoses('Sacubitril-Valsartan 97-103 mg zweimal täglich'),
    'Sacubitril-Valsartan 97/103 mg zweimal täglich',
  );
});

test('leaves a hyphenated range without a unit alone', () => {
  assert.equal(repairCombinationDoses('NYHA 2-3 Beschwerden'), 'NYHA 2-3 Beschwerden');
});

// ------------------------------------------------------------- combined ----

test('the full pipeline repairs a realistic transcript', () => {
  const raw =
    'Sie erhält Sacubitril-Valsartan 97-103 mg zweimal täglich, Bisoprolol 7,5 mg 100, ' +
    'Spironolacton 25 mg 100. Systolischer Druck 38 mm Quecksilbersäule. ASS 100 unverändert.';
  const got = repairTranscript(raw);
  assert.ok(got.includes('97/103 mg'));
  assert.ok(got.includes('Bisoprolol 7,5 mg 1-0-0'));
  assert.ok(got.includes('Spironolacton 25 mg 1-0-0'));
  assert.ok(got.includes('38 mmHg'));
  assert.ok(got.includes('ASS 100 unverändert'), 'strength must survive untouched');
});

test('repairs are idempotent', () => {
  const once = repairTranscript('Bisoprolol 5 mg 100, Druck 38 mm Quecksilbersäule');
  assert.equal(repairTranscript(once), once);
});
