/**
 * The Freigeben gate.
 *
 * SPEC constraint 4 makes Freigeben the boundary before anything can be copied
 * or exported, which makes it the last place a draft can be stopped. On
 * 2026-08-16 a letter whose entire body was a single [FEHLT: …] marker was
 * released and became copyable — the marker is a note to the doctor, not letter
 * text, and it would have gone into a patient's letter word for word.
 *
 *   npx tsx --test eval/release-gate.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { hasReleasableContent, letterSubstance } from '../prompts/beurteilung.ts';

// The draft that was actually released, shortened but the same shape.
const REFUSAL_ONLY = `- [FEHLT: Das vorliegende Diktat enthält keine auswertbaren kardiologischen
Anamnese- oder Befunddaten zu einem Patienten; es handelt sich um einen Dialog
ohne strukturierte medizinische Angaben, sodass eine Zusammenfassende
Beurteilung nicht erstellt werden kann. Bitte Diktat prüfen und erneut
aufnehmen.]`;

test('a draft that is nothing but a marker cannot be released', () => {
  assert.equal(hasReleasableContent(REFUSAL_ONLY), false);
  assert.equal(letterSubstance(REFUSAL_ONLY), '');
});

test('several markers and nothing else still cannot be released', () => {
  const text = `- [FEHLT: verwertbares Diktat, bitte erneut diktieren]
- [FEHLT: widersprüchliche Angabe, bitte prüfen]
- [FEHLT: Medikation nicht verwertbar erkannt]`;
  assert.equal(hasReleasableContent(text), false);
});

test('real prose alongside a marker CAN be released', () => {
  // This is the normal, intended case: the model wrote what it could and
  // flagged the one gap. Blocking here would be the over-refusal bug moved
  // into the UI.
  const text = `- Bezüglich der koronaren Herzkrankheit ist der Patient beschwerdefrei, eine
  Angina pectoris wird verneint.
- Echokardiographisch [FEHLT: LVEF nicht erhoben].`;
  assert.equal(hasReleasableContent(text), true);
  assert.match(letterSubstance(text), /Angina pectoris wird verneint/);
});

test('a clean draft is releasable', () => {
  const text = `- Der Patient ist beschwerdefrei; eine Belastungsdyspnoe wird verneint.`;
  assert.equal(hasReleasableContent(text), true);
});

test('substance excludes the marker text itself, not just the brackets', () => {
  const text = '- [FEHLT: Ejektionsfraktion nicht genannt] Der Patient ist beschwerdefrei.';
  const substance = letterSubstance(text);
  assert.equal(substance.includes('Ejektionsfraktion'), false);
  assert.equal(substance.includes('beschwerdefrei'), true);
});

test('empty and whitespace-only drafts are not releasable', () => {
  for (const text of ['', '   ', '\n\n', '- ', '-\n-\n-']) {
    assert.equal(hasReleasableContent(text), false, JSON.stringify(text));
  }
});
