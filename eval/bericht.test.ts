import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAbschnitt } from '../prompts/abschnitt.ts';
import {
  abschnittToNodes,
  bulletsToTiptap,
  canonicalSectionTitle,
  CANONICAL_SECTIONS,
  isTemplateBody,
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
const templateDoc = () => ({
  type: 'doc',
  content: [
    { type: 'paragraph' },
    ...CANONICAL_SECTIONS.flatMap((title) => [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: title }] },
      { type: 'paragraph' },
    ]),
  ],
});

test('isTemplateBody recognises a Bericht nobody has written in', () => {
  assert.equal(isTemplateBody(templateDoc()), true);
});

test('isTemplateBody survives the attributes the editor adds on load', () => {
  const doc = templateDoc();
  // What TipTap hands back after a round trip: attrs that were never written.
  for (const block of doc.content) {
    (block as Record<string, unknown>).attrs = {
      ...((block as { attrs?: object }).attrs ?? {}),
      textAlign: null,
    };
  }
  assert.equal(isTemplateBody(doc), true);
});

test('isTemplateBody counts extra empty lines as still untouched', () => {
  const doc = templateDoc();
  doc.content.push({ type: 'paragraph' }, { type: 'paragraph' });
  assert.equal(isTemplateBody(doc), true);
});

test('isTemplateBody refuses anything he actually put there', () => {
  const typed = templateDoc();
  typed.content[2] = { type: 'paragraph', content: [{ type: 'text', text: 'Z.n. Stent' }] } as never;
  assert.equal(isTemplateBody(typed), false, 'text typed under a heading');

  const listed = templateDoc();
  listed.content.push({ type: 'bulletList', content: [] } as never);
  assert.equal(isTemplateBody(listed), false, 'a list inserted at the end');

  const renamedHeading = templateDoc();
  renamedHeading.content[1] = {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: 'Verlauf' }],
  } as never;
  assert.equal(isTemplateBody(renamedHeading), false, 'a heading he renamed');

  const short = templateDoc();
  short.content = short.content.slice(0, 3);
  assert.equal(isTemplateBody(short), false, 'sections he deleted');
});

test('isTemplateBody rejects anything that is not a document', () => {
  assert.equal(isTemplateBody(null), false);
  assert.equal(isTemplateBody({ type: 'paragraph' }), false);
});
