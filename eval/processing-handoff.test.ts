import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimatePhaseMs,
  getProcessingHandoffCopy,
  getProcessingPreviewPhase,
  getProcessingSteps,
  isOverrunning,
  phaseProgress,
  PROGRESS_CEILING,
} from '../src/features/session/processing-handoff-model.ts';

test('transcription copy describes the handoff from recording to transcript', () => {
  assert.deepEqual(getProcessingHandoffCopy('gespraech', 'transcribing'), {
    title: 'Die Aufnahme wird übertragen',
    description: 'Gesprochenes wird jetzt in ein Transkript umgewandelt.',
    firstStep: 'active',
    secondStep: 'waiting',
  });
});

test('drafting copy distinguishes appointment notes from dictation text', () => {
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').title, 'Die Notizen entstehen');
  assert.equal(getProcessingHandoffCopy('beurteilung', 'notes').title, 'Der Text entsteht');
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').firstStep, 'done');
  assert.equal(getProcessingHandoffCopy('gespraech', 'notes').secondStep, 'active');
});

test('processing preview phases are development-only and reject unknown values', () => {
  assert.equal(getProcessingPreviewPhase('?processing=transcribing', true), 'transcribing');
  assert.equal(getProcessingPreviewPhase('?processing=notes', true), 'notes');
  assert.equal(getProcessingPreviewPhase('?processing=notes', false), null);
  assert.equal(getProcessingPreviewPhase('?processing=unknown', true), null);
});

test('transcription estimate grows with the length of the recording', () => {
  const short = estimatePhaseMs('transcribing', 60_000);
  const long = estimatePhaseMs('transcribing', 30 * 60_000);
  assert.ok(long > short, 'a 30-minute recording must be paced slower than a 1-minute one');
  // Drafting reads a transcript, not audio, so it barely scales.
  assert.ok(estimatePhaseMs('notes', 30 * 60_000) < long);
});

test('estimates stay positive when the recording length is unknown', () => {
  assert.ok(estimatePhaseMs('transcribing') > 0);
  assert.ok(estimatePhaseMs('notes', 0) > 0);
});

test('the progress bar never claims to be finished', () => {
  assert.equal(phaseProgress(0, 60_000), 0);
  assert.ok(phaseProgress(30_000, 60_000) > 0);
  // At and far beyond the estimate it holds short of full, so a slow run
  // never shows a completed bar next to an unfinished job.
  assert.equal(phaseProgress(60_000, 60_000), PROGRESS_CEILING);
  assert.equal(phaseProgress(10 * 60_000, 60_000), PROGRESS_CEILING);
  assert.ok(PROGRESS_CEILING < 1);
});

test('overrunning is reported once the estimate is passed', () => {
  assert.equal(isOverrunning(30_000, 60_000), false);
  assert.equal(isOverrunning(60_001, 60_000), true);
});

test('steps read as two labelled stages that advance with the phase', () => {
  const transcribing = getProcessingSteps('gespraech', 'transcribing');
  assert.deepEqual(transcribing.map((s) => s.state), ['active', 'waiting']);
  assert.equal(transcribing[0].label, 'Transkript wird erstellt');

  const notes = getProcessingSteps('gespraech', 'notes');
  assert.deepEqual(notes.map((s) => s.state), ['done', 'active']);
  assert.equal(notes[0].label, 'Transkript erstellt');
  assert.equal(notes[1].label, 'Notizen werden erstellt');

  assert.equal(getProcessingSteps('beurteilung', 'notes')[1].label, 'Beurteilung wird formuliert');
});
