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
  repairDrugDosing,
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

// ------------------------------------------- drug-anchored dosing schemes ----
//
// Regression set from HJ's own dictation of 2026-09-04. He dictates a
// medication list WITHOUT units — "Valsartan 160 1-0-0", never "160 Milligramm"
// — so the unit-anchored repair above never sees it. The recogniser returned
// the schemes slash-separated, rule 3 could not bring the lines into
// Präparat + Stärke form, and ASS and Tebonin were dropped from the letter.

test('normalises a scheme fused to the strength by a slash', () => {
  assert.equal(repairDrugDosing('Valsartan 160/1/0/0'), 'Valsartan 160 1-0-0');
  assert.equal(repairDrugDosing('Valsartan 80/0/0/1'), 'Valsartan 80 0-0-1');
});

test('normalises a scheme separated from the strength by a space', () => {
  assert.equal(repairDrugDosing('Pantoprazol 40 1/0/0'), 'Pantoprazol 40 1-0-0');
  assert.equal(repairDrugDosing('Rosuvastatin 40 0/0/1'), 'Rosuvastatin 40 0-0-1');
});

test('normalises a scheme with no strength at all', () => {
  assert.equal(repairDrugDosing('ASS 1/0/0'), 'ASS 1-0-0');
});

test('normalises a four-slot scheme with a night dose', () => {
  assert.equal(repairDrugDosing('Torasemid 10 1/0/0/1'), 'Torasemid 10 1-0-0-1');
});

test('normalises a half dose', () => {
  assert.equal(repairDrugDosing('Bisoprolol 2,5 0,5/0/0'), 'Bisoprolol 2,5 0,5-0-0');
});

test('reaches a drug name qualified by a second word', () => {
  assert.equal(
    repairDrugDosing('Tebonin Konzentrat 240 1/0/0'),
    'Tebonin Konzentrat 240 1-0-0',
  );
});

// ------------------------------------------------ and never guesses a dose ---

test('leaves an ambiguous fused strength exactly as dictated', () => {
  // "ASS 101/0/0" is "ASS 100 1-0-0" with the strength and the first slot run
  // together. Repairing it means choosing 100, which is inventing a dose — the
  // one thing this pipeline must never do. It stays wrong and visible.
  assert.equal(repairDrugDosing('ASS 101/0/0'), 'ASS 101/0/0');
});

test('drug-anchored repair leaves clinical numbers alone', () => {
  const samples = [
    'Blutdruck 172/80 mmHg',
    'Sauerstoffsättigung 97%',
    'MRT vom 02.09.26',
    'EF 55%, Aorta 3,6 cm',
    'QT korrigiert 434 Millisekunden',
    'PQ 166 Millisekunden',
  ];
  for (const sample of samples) {
    assert.equal(repairDrugDosing(sample), sample, sample);
  }
});

test('drug-anchored repair is idempotent', () => {
  const once = repairDrugDosing('Valsartan 160/1/0/0 und Pantoprazol 40 1/0/0');
  assert.equal(repairDrugDosing(once), once);
});

test('the full pipeline repairs HJ 2026-09-04 medication list', () => {
  const input =
    'Aktuelle Medikation: Valsartan 160/1/0/0, Valsartan 80/0/0/1. ASS 101/0/0, ' +
    'Pantoprazol 40 1/0/0, Tamsulosin 04 1/0/0, Rosuvastatin 40 0/0/1.';
  const out = repairTranscript(input);
  assert.match(out, /Valsartan 160 1-0-0/);
  assert.match(out, /Valsartan 80 0-0-1/);
  assert.match(out, /Pantoprazol 40 1-0-0/);
  assert.match(out, /Rosuvastatin 40 0-0-1/);
  // Untouched, on purpose.
  assert.match(out, /ASS 101\/0\/0/);
  assert.equal(repairTranscript(out), out);
});
