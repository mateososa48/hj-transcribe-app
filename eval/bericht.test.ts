import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAbschnitt } from '../prompts/abschnitt.ts';
import {
  abschnittToNodes,
  berichtTemplateDoc,
  BERICHT_TEMPLATE_SECTIONS,
  bulletsToTiptap,
  canonicalSectionTitle,
  isEmptyBody,
  isTemplateBody,
  leererBerichtDoc,
  sectionToTiptap,
} from '../src/features/document/insert.ts';

test('bulletsToTiptap builds a list with nesting and never drops prose', () => {
  const nodes = bulletsToTiptap('Vorbemerkung.\n- Erster Punkt\n  - Detail dazu\n- Zweiter Punkt');
  assert.equal(nodes[0]?.type, 'paragraph');
  const list = nodes[1];
  assert.equal(list?.type, 'bulletList');
  assert.equal(list?.content?.length, 2);
  const nested = list?.content?.[0]?.content?.find((c) => c.type === 'bulletList');
  assert.ok(nested, 'indented line nests under its parent item');
});

test('medikation keeps literal tabs in paragraph text', () => {
  const nodes = sectionToTiptap('medikation', '• ASS 100\t1-0-0\n• Bisoprolol 5\t1-0-0');
  assert.equal(nodes.length, 2);
  assert.ok(nodes[0]?.content?.[0]?.text?.includes('\t'));
});

test('abschnittToNodes prefixes the heading when announced', () => {
  const nodes = abschnittToNodes('Zusammenfassende Beurteilung', '- Punkt.');
  assert.equal(nodes[0]?.type, 'heading');
  assert.equal(nodes[0]?.content?.[0]?.text, 'Zusammenfassende Beurteilung');
  assert.equal(nodes[1]?.type, 'bulletList');
});

test('parseAbschnitt reads heading and text, tolerates damage', () => {
  const ok = parseAbschnitt(
    '<abschnitt_titel>Diagnosen</abschnitt_titel>\n<abschnitt>\n- KHK.\n</abschnitt>',
  );
  assert.deepEqual([ok.heading, ok.wellFormed], ['Diagnosen', true]);
  assert.equal(ok.text, '- KHK.');

  const empty = parseAbschnitt('<abschnitt_titel></abschnitt_titel>\n<abschnitt>\n- A.\n</abschnitt>');
  assert.equal(empty.heading, null);

  const broken = parseAbschnitt('<abschnitt>\n- Unvollständig');
  assert.equal(broken.wellFormed, false);
  assert.ok(broken.text.includes('Unvollständig'));
});

test('section titles normalize to his letter vocabulary', () => {
  assert.equal(canonicalSectionTitle('Medikation'), 'Aktuelle Therapie');
  assert.equal(canonicalSectionTitle('beurteilung'), 'Zusammenfassende Beurteilung');
  assert.equal(canonicalSectionTitle('Vorgeschichte'), 'Anamnese');
  assert.equal(canonicalSectionTitle('Messwerte'), 'Befunde');
  assert.equal(canonicalSectionTitle('Diagnosen:'), 'Diagnosen');
  assert.equal(canonicalSectionTitle('Analyse'), 'Analyse');
});

/**
 * The test behind auto-discarding an unused Bericht. Getting this wrong in the
 * lenient direction leaves blank letters piling up; getting it wrong in the
 * strict direction deletes something he wrote, which is the unforgivable half.
 */
interface Block {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
}
const templateDoc = (): { type: string; content: Block[] } =>
  JSON.parse(JSON.stringify(berichtTemplateDoc()));

test('the blank Bericht is his letter, not a form of every section that exists', () => {
  const headings = templateDoc()
    .content.filter((b) => b.type === 'heading')
    .map((b) => b.content?.[0]?.text) as Array<string | undefined>;
  // Checked before deepEqual: that assertion narrows `headings` to the tuple.
  assert.ok(
    !headings.some((h) => h === 'Befunde'),
    'Befunde is not a section his letters open with',
  );
  assert.deepEqual(headings, [...BERICHT_TEMPLATE_SECTIONS]);
});

test('the Kopf carries only wording that never changes', () => {
  const text = templateDoc()
    .content.map((b) => b.content?.[0]?.text ?? '')
    .join(' ');
  assert.match(text, /Sehr geehrte Frau Kollegin/);
  assert.match(text, /zusammenfassend berichten/);
  // Nothing patient-specific may ever be born into a blank letter.
  assert.doesNotMatch(text, /\d{2}\.\d{2}\.\d{4}/, 'no invented date');
});

test('isTemplateBody recognises a Bericht nobody has written in', () => {
  assert.equal(isTemplateBody(templateDoc()), true);
});

/**
 * The other shape a new Bericht can be born with. discardIfUntouched clears
 * an abandoned one away by asking these two questions, so a blank page that
 * stopped counting as blank would quietly start littering his Berichte list.
 */
test('the blank page is one empty paragraph — the caret has somewhere to go', () => {
  const doc = leererBerichtDoc();
  assert.equal(doc.content.length, 1);
  assert.equal(doc.content[0]?.type, 'paragraph');
  assert.equal(doc.content[0]?.content, undefined);
});

test('isEmptyBody recognises the blank page, and only while it is still blank', () => {
  assert.equal(isEmptyBody(leererBerichtDoc()), true);
  // Extra empty lines are still nothing written.
  assert.equal(isEmptyBody({ type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph' }] }), true);
  // One word of his, and it is his.
  assert.equal(
    isEmptyBody({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mainz,' }] }] }),
    false,
  );
  // The two shapes never answer for each other.
  assert.equal(isEmptyBody(templateDoc()), false);
  assert.equal(isTemplateBody(leererBerichtDoc()), false);
});

test('isTemplateBody survives the attributes the editor adds on load', () => {
  const doc = templateDoc();
  // What TipTap hands back after a round trip: attrs that were never written.
  for (const block of doc.content) {
    block.attrs = { ...(block.attrs ?? {}), textAlign: null };
  }
  assert.equal(isTemplateBody(doc), true);
});

test('isTemplateBody counts extra empty lines as still untouched', () => {
  const doc = templateDoc();
  doc.content.push({ type: 'paragraph' }, { type: 'paragraph' });
  assert.equal(isTemplateBody(doc), true);
});

test('isTemplateBody refuses a Kopf he has filled in', () => {
  const doc = templateDoc();
  const anIndex = doc.content.findIndex((b) => b.content?.[0]?.text === 'An');
  doc.content[anIndex + 1] = {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Dres. med. Roth/Hagenbäumer/Göhre' }],
  };
  assert.equal(isTemplateBody(doc), false);
});

test('isTemplateBody refuses anything he actually put there', () => {
  const typed = templateDoc();
  const firstHeading = typed.content.findIndex((b) => b.type === 'heading');
  typed.content[firstHeading + 1] = {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Z.n. Stent' }],
  };
  assert.equal(isTemplateBody(typed), false, 'text typed under a heading');

  const listed = templateDoc();
  listed.content.push({ type: 'bulletList', content: [] } as never);
  assert.equal(isTemplateBody(listed), false, 'a list inserted at the end');

  const renamedHeading = templateDoc();
  const idx = renamedHeading.content.findIndex((b) => b.type === 'heading');
  renamedHeading.content[idx] = {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: 'Verlauf' }],
  };
  assert.equal(isTemplateBody(renamedHeading), false, 'a heading he renamed');

  const short = templateDoc();
  short.content = short.content.slice(0, 3);
  assert.equal(isTemplateBody(short), false, 'sections he deleted');
});

test('isTemplateBody rejects anything that is not a document', () => {
  assert.equal(isTemplateBody(null), false);
  assert.equal(isTemplateBody({ type: 'paragraph' }), false);
});
