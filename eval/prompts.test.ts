/**
 * Prompt contract and parsing.
 *
 * Two classes of guarantee:
 *
 *  - PARSING: the model's output must survive the trip into the editor, and a
 *    malformed response must degrade to editable text rather than an exception.
 *  - CONTENT: the safety rules must actually be in the prompt. These are not
 *    style preferences — dropping rule 1 invents facts, dropping rule 2 flips
 *    negations, dropping rule 3 guesses doses. A careless edit to rules.ts
 *    should fail a test, not ship.
 *
 *   npx tsx --test eval/prompts.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BEURTEILUNG_TAG,
  buildStableSystemPrompt,
  buildUserPrompt,
  parseBeurteilung,
} from '../prompts/beurteilung.ts';
import {
  GESPRAECH_SECTIONS,
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../prompts/gespraech.ts';
import { DEV_BEURTEILUNG_EXAMPLES } from '../prompts/examples/dev/index.ts';
import { CORE_RULES } from '../prompts/rules.ts';

const GLOSSARY = ['Bisoprolol', 'NSTEMI'];
const stable = () => buildStableSystemPrompt(DEV_BEURTEILUNG_EXAMPLES, GLOSSARY);

// ---------------------------------------------------------------- parsing ---

test('extracts the section from a well-formed response', () => {
  const raw = `Hier ist der Entwurf:\n<${BEURTEILUNG_TAG}>\n- Erster Punkt\n- Zweiter Punkt\n</${BEURTEILUNG_TAG}>\nEnde.`;
  const { text, wellFormed } = parseBeurteilung(raw);
  assert.equal(wellFormed, true);
  assert.equal(text, '- Erster Punkt\n- Zweiter Punkt');
  assert.ok(!text.includes('Hier ist der Entwurf'), 'preamble must be stripped');
});

test('an unclosed tag still yields usable text, flagged as malformed', () => {
  const raw = `<${BEURTEILUNG_TAG}>\n- Ein Punkt, abgeschnitten`;
  const { text, wellFormed } = parseBeurteilung(raw);
  assert.equal(wellFormed, false);
  assert.equal(text, '- Ein Punkt, abgeschnitten');
});

test('no tag at all falls back to the whole response rather than throwing', () => {
  const { text, wellFormed } = parseBeurteilung('- Ein Punkt ohne Tags');
  assert.equal(wellFormed, false);
  assert.equal(text, '- Ein Punkt ohne Tags');
});

test('German content survives parsing byte-for-byte', () => {
  const body = '- LVEF 55 %, LVEDD 4,7 cm, keine Angina pectoris, Bisoprolol 5 mg 1-0-0';
  const { text } = parseBeurteilung(`<${BEURTEILUNG_TAG}>${body}</${BEURTEILUNG_TAG}>`);
  assert.equal(text, body);
});

test('the four consultation sections parse independently', () => {
  const raw = `<zusammenfassung>\n- Verlaufskontrolle\n</zusammenfassung>
<diagnosen>\n- KHK\n</diagnosen>
<anamnese>\nBeschwerdefrei.\n</anamnese>
<medikation>\nASS 100\t1-0-0\n</medikation>`;
  const { sections, wellFormed } = parseGespraech(raw);
  assert.equal(wellFormed, true);
  assert.equal(sections.zusammenfassung, '- Verlaufskontrolle');
  assert.equal(sections.diagnosen, '- KHK');
  assert.equal(sections.anamnese, 'Beschwerdefrei.');
  assert.equal(sections.medikation, 'ASS 100\t1-0-0');
});

test('an empty section block parses as empty, and stays well-formed', () => {
  const raw = `<zusammenfassung>\n- x\n</zusammenfassung>
<diagnosen>\n</diagnosen>
<anamnese>\nText.\n</anamnese>
<medikation>\nKeine\n</medikation>`;
  const { sections, wellFormed } = parseGespraech(raw);
  assert.equal(wellFormed, true);
  assert.equal(sections.diagnosen, '');
});

test('a missing closing tag on one section recovers the content and flags it', () => {
  const raw = `<zusammenfassung>\n- x\n<diagnosen>\n- KHK\n</diagnosen>\n<anamnese>\nT.\n</anamnese>\n<medikation>\nKeine\n</medikation>`;
  const { sections, wellFormed } = parseGespraech(raw);
  assert.equal(wellFormed, false);
  assert.ok(sections.zusammenfassung.includes('- x'));
  assert.equal(sections.diagnosen, '- KHK');
});

// ---------------------------------------------------------------- content ---

test('the safety rules are present in both prompts', () => {
  for (const prompt of [stable(), buildGespraechSystemPrompt(GLOSSARY)]) {
    assert.match(prompt, /NIEMALS ETWAS ERFINDEN/);
    assert.match(prompt, /NEGATIONEN BLEIBEN WÖRTLICH ERHALTEN/);
    assert.match(prompt, /DOSIERUNGEN NIEMALS RATEN/);
    assert.match(prompt, /UNVERÄNDERT ÜBERNEHMEN/);
    assert.match(prompt, /KEINE DIAGNOSEN UND KEINE CODES/);
    assert.match(prompt, /ICD- oder GOÄ-Codes/);
  }
});

test('the marker system is really gone — no FEHLT anywhere in any prompt', () => {
  // The removal was deliberate (the transcript is the ground truth now); a
  // half-removed marker instruction would make output format unpredictable.
  for (const prompt of [stable(), buildGespraechSystemPrompt(GLOSSARY)]) {
    assert.ok(!prompt.includes('FEHLT'), 'marker instruction survived');
  }
});

test('rules cover the failures found in live testing', () => {
  // Each of these regressed once. The counts are in git history.
  assert.match(CORE_RULES, /ausgesprochene Verneinung darf nicht wegfallen/);
  assert.match(CORE_RULES, /Korrigiert sich DIESELBE Person/);
  assert.match(CORE_RULES, /Widerspricht eine ANDERE Person/);
  assert.match(CORE_RULES, /"hohes Cholesterin" wird nicht\s*\n?\s*"Hypercholesterinämie"/);
  assert.match(CORE_RULES, /Schweizer Schreibung/);
  assert.match(CORE_RULES, /Kein medizinischer Inhalt erkannt\./);
});

test('patient data never enters the cached prompt half', () => {
  const system = stable();
  const user = buildUserPrompt({ transcript: 'PATIENT-MARKER-XYZ' });
  assert.ok(!system.includes('PATIENT-MARKER-XYZ'));
  assert.ok(user.includes('PATIENT-MARKER-XYZ'));

  const gSystem = buildGespraechSystemPrompt([]);
  const gUser = buildGespraechUserPrompt({ transcript: 'PATIENT-MARKER-XYZ' });
  assert.ok(!gSystem.includes('PATIENT-MARKER-XYZ'));
  assert.ok(gUser.includes('PATIENT-MARKER-XYZ'));
});

test('the consultation prompt demands all four blocks', () => {
  const prompt = buildGespraechSystemPrompt([]);
  for (const key of GESPRAECH_SECTIONS) {
    assert.ok(prompt.includes(`<${key}>`), `missing block ${key}`);
  }
  assert.match(prompt, /MEDIKATION[\s\S]*TABULATOR/);
  assert.match(prompt, /niemals zu "ASS 100 mg"/);
});
