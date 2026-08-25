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

import { bulletsToHtml, toBulletText } from '../src/lib/format.ts';

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
