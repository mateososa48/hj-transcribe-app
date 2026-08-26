import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildErgaenzungTranscript } from '../src/lib/ergaenzung-prompt.ts';

test('the merge input carries both texts, clearly labelled', () => {
  const prompt = buildErgaenzungTranscript('\u2022 Bestehender Punkt.', 'Neu diktierter Satz.');
  assert.ok(prompt.includes('BEREITS ERSTELLTE BEURTEILUNG'));
  assert.ok(prompt.includes('\u2022 Bestehender Punkt.'));
  assert.ok(prompt.includes('ERG\u00c4NZENDES DIKTAT'));
  assert.ok(prompt.includes('Neu diktierter Satz.'));
  assert.ok(prompt.indexOf('Bestehender Punkt') < prompt.indexOf('Neu diktierter Satz'));
});
