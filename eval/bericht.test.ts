import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAbschnitt } from '../prompts/abschnitt.ts';
import { abschnittToNodes, bulletsToTiptap, sectionToTiptap } from '../src/features/document/insert.ts';

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
