import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProcessingHandoffCopy,
  getProcessingPreviewPhase,
} from '../src/features/session/processing-handoff-model.ts';

test('transcription copy describes the handoff from recording to transcript', () => {
  assert.deepEqual(getProcessingHandoffCopy('gespraech', 'transcribing'), {
    title: 'Die Aufnahme wird übertragen',
    description: 'Gesprochenes wird jetzt in ein Transkript umgewandelt.',
    sourceLabel: 'Aufnahme',
    targetLabel: 'Transkript',
    firstStep: 'active',
    secondStep: 'waiting',
  });
});

test('drafting copy distinguishes appointment notes from dictation text', () => {
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').title, 'Die Notizen entstehen');
  assert.equal(getProcessingHandoffCopy('beurteilung', 'notes').title, 'Der Text entsteht');
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').targetLabel, 'Notizen');
  assert.equal(getProcessingHandoffCopy('beurteilung', 'notes').targetLabel, 'Beurteilung');
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').firstStep, 'done');
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').secondStep, 'active');
});

test('processing preview phases are development-only and reject unknown values', () => {
  assert.equal(getProcessingPreviewPhase('?processing=transcribing', true), 'transcribing');
  assert.equal(getProcessingPreviewPhase('?processing=notes', true), 'notes');
  assert.equal(getProcessingPreviewPhase('?processing=notes', false), null);
  assert.equal(getProcessingPreviewPhase('?processing=unknown', true), null);
});
