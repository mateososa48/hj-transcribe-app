import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseUebersetzung, TRANSLATION_LANGUAGES } from '../prompts/uebersetzung.ts';
import type { TiptapNode } from '../src/features/document/insert.ts';
import {
  applySegments,
  collectSegments,
  translatedTitle,
  untranslatedCount,
} from '../src/features/document/translate.ts';

/** A letter shaped like his: headings, prose, a bullet, a Medikation row. */
const letter: TiptapNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Diagnosen' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Koronare Herzkrankheit.' }] },
    { type: 'paragraph' },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Erster Punkt.' }] }],
        },
      ],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'ASS 100\t\t1-0-0' }] },
  ],
};

test('every block that carries words becomes one segment, in reading order', () => {
  assert.deepEqual(collectSegments(letter), [
    'Diagnosen',
    'Koronare Herzkrankheit.',
    'Erster Punkt.',
    'ASS 100\t\t1-0-0',
  ]);
});

test('an empty paragraph is not a segment', () => {
  const empty: TiptapNode = {
    type: 'doc',
    content: [{ type: 'paragraph' }, { type: 'paragraph', content: [] }],
  };
  assert.deepEqual(collectSegments(empty), []);
});

test('a sentence split by a mark is one segment, not three', () => {
  const doc: TiptapNode = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Der Blutdruck lag bei ' },
          { type: 'text', text: '145/90', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' mmHg.' },
        ],
      },
    ],
  };
  assert.deepEqual(collectSegments(doc), ['Der Blutdruck lag bei 145/90 mmHg.']);
});

test('the translation lands in the blocks it came from, structure untouched', () => {
  const out = applySegments(letter, [
    'Diagnoses',
    'Coronary artery disease.',
    'First point.',
    'Aspirin 100 mg\t\tonce daily',
  ]) as typeof letter;

  assert.equal(out.content?.[0]?.type, 'heading');
  assert.equal(out.content?.[0]?.attrs?.level, 2);
  assert.equal(out.content?.[0]?.content?.[0]?.text, 'Diagnoses');
  // The empty paragraph is still there, still empty.
  assert.equal(out.content?.[2]?.type, 'paragraph');
  assert.equal(out.content?.[2]?.content, undefined);
  // The bullet is still a bullet.
  assert.equal(out.content?.[3]?.type, 'bulletList');
  // The tabs the Medikation columns stand on survived.
  assert.equal(out.content?.[4]?.content?.[0]?.text, 'Aspirin 100 mg\t\tonce daily');
});

test('the original document is never mutated', () => {
  const before = JSON.stringify(letter);
  applySegments(letter, ['A', 'B', 'C', 'D']);
  assert.equal(JSON.stringify(letter), before);
});

test('a missing segment keeps its German instead of shifting the rest up', () => {
  const out = applySegments(letter, ['Diagnoses', null, 'First point.', null]) as typeof letter;
  assert.equal(out.content?.[0]?.content?.[0]?.text, 'Diagnoses');
  assert.equal(out.content?.[1]?.content?.[0]?.text, 'Koronare Herzkrankheit.');
  assert.equal(out.content?.[4]?.content?.[0]?.text, 'ASS 100\t\t1-0-0');
  assert.equal(untranslatedCount(['Diagnoses', null, 'First point.', null]), 2);
});

test('a block that was bold stays bold', () => {
  const doc: TiptapNode = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Befund', marks: [{ type: 'bold' }] }] },
    ],
  };
  const out = applySegments(doc, ['Findings']) as typeof doc;
  assert.deepEqual(out.content?.[0]?.content?.[0]?.marks, [{ type: 'bold' }]);
});

test('the response is read by index, so a reordered answer still lands right', () => {
  const raw = '<ueb i="2">two</ueb>\n<ueb i="1">one</ueb>\n<ueb i="3">three</ueb>';
  const { segments, wellFormed } = parseUebersetzung(raw, 3);
  assert.deepEqual(segments, ['one', 'two', 'three']);
  assert.equal(wellFormed, true);
});

test('a dropped block is a null in its own slot, and the answer is not well formed', () => {
  const { segments, wellFormed } = parseUebersetzung('<ueb i="1">one</ueb>', 3);
  assert.deepEqual(segments, ['one', null, null]);
  assert.equal(wellFormed, false);
});

test('an index outside the letter is ignored rather than trusted', () => {
  const { segments } = parseUebersetzung('<ueb i="9">stray</ueb><ueb i="1">one</ueb>', 2);
  assert.deepEqual(segments, ['one', null]);
});

const ENDONYMS = TRANSLATION_LANGUAGES.map((l) => l.endonym);

test('the copy is named after the original, in the language it is written in', () => {
  assert.equal(
    translatedTitle('Bericht Vollmer, Kontrolle', 'English', ENDONYMS),
    'Bericht Vollmer, Kontrolle (English)',
  );
  assert.equal(translatedTitle('  ', 'Türkçe', ENDONYMS), 'Bericht (Türkçe)');
});

test('translating a translation replaces the language in the name, never stacks it', () => {
  assert.equal(
    translatedTitle('Bericht Vollmer, Kontrolle (English)', 'Deutsch', ENDONYMS),
    'Bericht Vollmer, Kontrolle (Deutsch)',
  );
  // A bracket that is not a language is his own writing and stays.
  assert.equal(
    translatedTitle('Bericht Vollmer (Kontrolle)', 'English', ENDONYMS),
    'Bericht Vollmer (Kontrolle) (English)',
  );
});

test('German is offered too, so a translation can be turned back', () => {
  assert.ok(TRANSLATION_LANGUAGES.some((l) => l.code === 'de'));
  for (const language of TRANSLATION_LANGUAGES) {
    assert.ok(language.label.length > 0, language.code);
    assert.ok(language.endonym.length > 0, language.code);
  }
  // Every code appears once: the menu filters on it.
  const codes = TRANSLATION_LANGUAGES.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
});
