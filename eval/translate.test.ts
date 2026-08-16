/**
 * Translation structural check.
 *
 * The danger with medical translation is not clumsy prose — it is a fluent
 * translation that quietly dropped a dose or a measurement. Nothing about the
 * output looks wrong, so it has to be caught mechanically.
 *
 *   npx tsx --test eval/translate.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TARGET_LANGUAGES,
  buildTranslationSystemPrompt,
  checkTranslation,
  parseTranslation,
} from '../prompts/translate.ts';

const GERMAN = [
  '- Bei dem Patienten besteht ein Z.n. NSTEMI 03/25. Aktuell werden eine Angina pectoris',
  '  und eine Dyspnoe verneint.',
  '- Echokardiographisch zeigt sich eine LVEF von 55 % bei einem LVEDD von 52 mm.',
  '- Der Patient erhält Bisoprolol 5 mg 1-0-0 sowie Atorvastatin 80 mg 0-0-1.',
  '- [FEHLT: Geburtsdatum des Patienten]',
].join('\n');

const GOOD_ENGLISH = [
  '- The patient has a history of NSTEMI 03/25. Angina pectoris and dyspnoea are',
  '  currently denied.',
  '- Echocardiography shows an LVEF of 55 % with an LVEDD of 52 mm.',
  '- The patient receives Bisoprolol 5 mg 1-0-0 and Atorvastatin 80 mg 0-0-1.',
  '- [FEHLT: patient date of birth]',
].join('\n');

test('a faithful translation passes every check', () => {
  const check = checkTranslation(GERMAN, GOOD_ENGLISH);
  assert.deepEqual(check.missingNumbers, []);
  assert.deepEqual(check.missingDosing, []);
  assert.equal(check.fehltDelta, 0);
  assert.equal(check.bulletDelta, 0);
  assert.equal(check.ok, true);
});

test('catches a DROPPED MEASUREMENT', () => {
  const bad = GOOD_ENGLISH.replace(' with an LVEDD of 52 mm', '');
  const check = checkTranslation(GERMAN, bad);
  assert.equal(check.ok, false);
  assert.ok(check.missingNumbers.some((n) => n.includes('52')), 'should flag the missing 52 mm');
});

test('catches a DROPPED DOSING SCHEME', () => {
  const bad = GOOD_ENGLISH.replace(' 1-0-0', '');
  const check = checkTranslation(GERMAN, bad);
  assert.equal(check.ok, false);
  assert.deepEqual(check.missingDosing, ['1-0-0']);
});

test('catches a CHANGED DOSE', () => {
  const bad = GOOD_ENGLISH.replace('Bisoprolol 5 mg', 'Bisoprolol 50 mg');
  const check = checkTranslation(GERMAN, bad);
  assert.equal(check.ok, false);
  assert.ok(check.missingNumbers.length > 0);
});

test('catches a LOST [FEHLT] marker', () => {
  const bad = GOOD_ENGLISH.replace('- [FEHLT: patient date of birth]', '- Date of birth unknown');
  const check = checkTranslation(GERMAN, bad);
  assert.equal(check.ok, false);
  assert.equal(check.fehltDelta, 1);
});

test('catches MERGED bullet points', () => {
  const bad = GOOD_ENGLISH.split('\n').filter((l) => !l.startsWith('- [FEHLT')).join('\n');
  assert.ok(checkTranslation(GERMAN, bad).bulletDelta > 0);
});

test('a decimal comma converted to a point is caught as a changed number', () => {
  // His own English reports keep the German comma, so this is a real regression.
  const de = '- Vena cava 2,5 cm, Interventrikuläres Septum 0,7 cm.';
  const en = '- Vena cava 2.5 cm, interventricular septum 0.7 cm.';
  assert.equal(checkTranslation(de, en).ok, false);
});

// ------------------------------------------------------------- prompt ------

test('the translation prompt forbids the dangerous transformations', () => {
  const prompt = buildTranslationSystemPrompt(TARGET_LANGUAGES[0]!);
  for (const needle of [
    'NEVER ADD, REMOVE OR REINTERPRET',
    'NEGATIONS',
    'Do NOT convert units',
    '4,7 cm',
    'DRUG NAMES AND DOSING STAY EXACTLY',
    '[FEHLT:',
  ]) {
    assert.ok(prompt.includes(needle), `translation prompt lost: ${needle}`);
  }
});

test('the prompt names the requested target language', () => {
  const fr = TARGET_LANGUAGES.find((l) => l.code === 'fr')!;
  assert.ok(buildTranslationSystemPrompt(fr).includes('French'));
});

test('parses the tagged response and degrades gracefully', () => {
  assert.equal(parseTranslation('<uebersetzung>Hello</uebersetzung>').text, 'Hello');
  assert.equal(parseTranslation('<uebersetzung>Hello').wellFormed, false);
  assert.equal(parseTranslation('Bare text').text, 'Bare text');
});
