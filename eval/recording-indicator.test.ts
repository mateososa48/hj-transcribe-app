/**
 * The global recording indicator.
 *
 * The thing being pinned is a safety property, not a look: while the
 * microphone is open, every view says so and offers a way to close it. The
 * failure this guards against is silent — the app looks identical recording or
 * not, he walks away, and the consultation keeps running into the session.
 *
 * Two halves, both pure, so neither needs a browser:
 *   - isRecordingVisible: when the strip is on screen.
 *   - RecordingIndicatorBar: what it says when it is.
 *
 *   npx tsx --test eval/recording-indicator.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  RecordingIndicatorBar,
  isRecordingVisible,
} from '../src/components/recording-indicator-bar.tsx';

/** The bar as it renders, for a given elapsed time. */
function render(elapsed: string, stopping = false): string {
  return renderToStaticMarkup(
    createElement(RecordingIndicatorBar, {
      elapsed,
      stopping,
      onOpen: () => {},
      onStop: () => {},
    }),
  );
}

test('visible for the whole time the microphone is open', () => {
  assert.equal(isRecordingVisible('recording'), true);
  // The stop is asynchronous — the last chunk still has to be flushed and the
  // session row written. Vanishing at the click would say "over" too early.
  assert.equal(isRecordingVisible('stopping'), true);
});

test('gone once the recording is not running', () => {
  assert.equal(isRecordingVisible('idle'), false);
  assert.equal(isRecordingVisible('stopped'), false);
  assert.equal(isRecordingVisible('requesting-mic'), false);
  assert.equal(isRecordingVisible('error'), false);
});

test('says it is recording, for how long, and how to stop', () => {
  const html = render('04:12');

  assert.match(html, /Aufnahme läuft/);
  assert.match(html, /04:12/);
  assert.match(html, /Aufnahme beenden/);
  // Announced, not just drawn: he may be looking at the letter, not the strip.
  assert.match(html, /role="status"/);
});

test('the stop key is disabled and renamed while the stop is in flight', () => {
  const html = render('04:12', true);

  assert.match(html, /Wird beendet/);
  assert.doesNotMatch(html, />Aufnahme beenden</);
  // A second click during the flush would start the pipeline twice.
  assert.match(html, /disabled/);
});
