/**
 * Bullet formatting — what lands on the clipboard.
 *
 * The reported failure: copying "- " lines into Word or Google Docs pasted as
 * literal dashes, not a bulleted list. The fix copies text/html; these tests
 * pin the HTML shape (including the nested diagnoses) and the dash→bullet
 * display transform.
 *
 *   npx tsx --test eval/format.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bulletsToHtml, clipboardPayload, toBulletText } from '../src/lib/format.ts';

test('dashes become bullets, indentation preserved', () => {
  assert.equal(toBulletText('- eins\n  - zwei\n- drei'), '• eins\n  • zwei\n• drei');
});

test('already-bulleted text is left alone', () => {
  assert.equal(toBulletText('• eins\n• zwei'), '• eins\n• zwei');
});

test('prose without bullets is untouched', () => {
  const prose = 'Seit dem Infarkt beschwerdefrei. Keine Luftnot.';
  assert.equal(toBulletText(prose), prose);
});

test('flat list becomes a flat <ul>', () => {
  assert.equal(bulletsToHtml('• eins\n• zwei'), '<ul><li>eins</li><li>zwei</li></ul>');
});

test('his nested diagnosis shape becomes a nested list', () => {
  const html = bulletsToHtml('• Koronare Herzkrankheit mit\n  • Z.n. Infarkt 11/22\n  • Z.n. Stent\n• Hypertonie');
  assert.equal(
    html,
    '<ul><li>Koronare Herzkrankheit mit<ul><li>Z.n. Infarkt 11/22</li><li>Z.n. Stent</li></ul></li><li>Hypertonie</li></ul>',
  );
});

test('wrapped continuation lines fold into their item', () => {
  const html = bulletsToHtml('• Ein langer Punkt,\n  der umbrochen wurde ohne Aufzählungszeichen');
  // two leading spaces but no bullet marker -> continuation, not nested item
  assert.equal(html, '<ul><li>Ein langer Punkt, der umbrochen wurde ohne Aufzählungszeichen</li></ul>');
});

test('HTML in the letter text is escaped, not injected', () => {
  assert.equal(bulletsToHtml('• LVEF <55 % & steigend'), '<ul><li>LVEF &lt;55 % &amp; steigend</li></ul>');
});

test('bulletsToHtml never drops prose outside items', () => {
  const html = bulletsToHtml('Vorbemerkung ohne Punkt.\n• Erster Punkt\n• Zweiter Punkt');
  assert.equal(html, '<p>Vorbemerkung ohne Punkt.</p><ul><li>Erster Punkt</li><li>Zweiter Punkt</li></ul>');
  const tail = bulletsToHtml('• Punkt eins');
  assert.equal(tail, '<ul><li>Punkt eins</li></ul>');
});

// ------------------------------------------------------------- clipboard ---
//
// The bug these pin: which flavour goes on the clipboard used to be chosen by
// SECTION NAME, from a list of three. A Termin's sections are the
// conversation's own now, so "Beschwerden" was not on that list and its
// bullets pasted into Word as literal • characters.

test('bulleted text carries an html flavour, whatever the section is called', () => {
  const { html, plain } = clipboardPayload('• Beschwerdefrei\n• Keine Luftnot');
  assert.ok(html?.includes('<ul>'), 'expected a real list for Word');
  assert.ok(html?.includes('<li>Beschwerdefrei</li>'));
  assert.ok(!plain.includes('<'));
});

test('dash bullets count too — the model writes them before conversion', () => {
  assert.ok(clipboardPayload('- eins\n- zwei').html?.includes('<li>eins</li>'));
});

test('columns go plain, so the tabs survive byte-for-byte', () => {
  const med = 'ASS 100\t1-0-0\nRosuvastatin 20\t0-0-1';
  const { html, plain } = clipboardPayload(med);
  assert.equal(html, undefined, 'an html flavour would be pasted in preference to the tabs');
  assert.equal(plain, med);
});

test('a bulleted section that also holds a tab stays plain — the doses win', () => {
  const { html } = clipboardPayload('• ASS 100\t1-0-0');
  assert.equal(html, undefined);
});

test('prose goes plain and unchanged', () => {
  const prose = 'Seit dem Infarkt beschwerdefrei.';
  assert.deepEqual(clipboardPayload(prose), { plain: prose });
});

test('medication columns lose their bullet — the tab stop is what aligns them', () => {
  const out = toBulletText('- ASS 100\t1-0-0\n- Bisoprolol 5\t1-0-0');
  assert.equal(out, 'ASS 100\t1-0-0\nBisoprolol 5\t1-0-0');
});

test('a bullet already sitting on a column line is stripped too', () => {
  assert.equal(toBulletText('• ASS 100\t1-0-0'), 'ASS 100\t1-0-0');
});

test('bullets on ordinary lines are untouched by that rule', () => {
  assert.equal(toBulletText('- Beschwerdefrei\n- Keine Luftnot'), '• Beschwerdefrei\n• Keine Luftnot');
});
