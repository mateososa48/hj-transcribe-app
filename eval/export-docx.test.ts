/**
 * The Word file, read back.
 *
 * This is the last step of the whole product — the letter leaves here and goes
 * into his template — and it is the one step a screenshot cannot check. A
 * bullet that arrives as a paragraph, a tab that arrives as a space, or a line
 * break that arrives welded to the line above are all invisible until he opens
 * the file in Word and finds his Medikation columns collapsed.
 *
 * So: pack the document and read the XML.
 *
 *   npx tsx --test eval/export-docx.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { Packer } from 'docx';
import PizZip from 'pizzip';

import { buildDocx } from '../src/features/document/export-docx.ts';
import { berichtTemplateDoc } from '../src/features/document/insert.ts';

async function documentXml(json: unknown, title = 'Bericht'): Promise<string> {
  const { file } = buildDocx(json, title);
  const buffer = await Packer.toBuffer(file);
  return new PizZip(buffer).file('word/document.xml')!.asText();
}

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const para = (...content: unknown[]) => ({ type: 'paragraph', content });

test('a blank Bericht exports its Kopf and its headings', async () => {
  const xml = await documentXml(berichtTemplateDoc());
  assert.match(xml, /Sehr geehrte Frau Kollegin/);
  for (const heading of ['Diagnosen', 'Anamnese', 'Zusammenfassende Beurteilung', 'Aktuelle Therapie']) {
    assert.ok(xml.includes(heading), `${heading} reaches the Word file`);
  }
  assert.ok(!xml.includes('Befunde'), 'a section he removed does not come back in the export');
  // Headings must be real Word headings, not bold paragraphs.
  assert.match(xml, /w:pStyle w:val="Heading2"/);
});

async function stylesXml(json: unknown): Promise<string> {
  const { file } = buildDocx(json, 'Bericht');
  return new PizZip(await Packer.toBuffer(file)).file('word/styles.xml')!.asText();
}

test('Heading2 is defined once, so Word cannot fall back to its own blue', async () => {
  const styles = await stylesXml(berichtTemplateDoc());
  const ids = [...styles.matchAll(/w:styleId="(Heading\d)"/g)].map((m) => m[1]);
  const heading2 = ids.filter((id) => id === 'Heading2');
  assert.equal(
    heading2.length,
    1,
    'a duplicate styleId makes Word take its own definition, not ours',
  );
});

test('his section headings are body size, bold and underlined in Word too', async () => {
  const styles = await stylesXml(berichtTemplateDoc());
  const at = styles.indexOf('w:styleId="Heading2"');
  const block = styles.slice(at, styles.indexOf('</w:style>', at));
  assert.match(block, /w:sz w:val="22"/, '11pt — the same size as his body text');
  assert.match(block, /<w:b\b/, 'bold');
  assert.match(block, /<w:u\b/, 'underlined');
  assert.ok(!/2E74B5/.test(block), "Word's default heading blue never reaches his letter");
});

test('a heading run never turns off what its style turned on', async () => {
  const xml = await documentXml(berichtTemplateDoc());
  assert.ok(
    !xml.includes('<w:b w:val="false"/>'),
    'an explicit bold-off on the run beats the heading style',
  );
});

test('bullets survive as Word list items, not as dashes in a paragraph', async () => {
  const xml = await documentXml(
    doc({
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [para(text('Koronare Herzkrankheit'))] },
        { type: 'listItem', content: [para(text('Arterielle Hypertonie'))] },
      ],
    }),
  );
  assert.match(xml, /w:numPr/, 'list numbering properties are present');
  assert.ok(!xml.includes('- Koronare'), 'the dash marker never reaches the file');
});

test('a nested bullet keeps its own level', async () => {
  const xml = await documentXml(
    doc({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            para(text('Koronare Herzkrankheit mit')),
            {
              type: 'bulletList',
              content: [{ type: 'listItem', content: [para(text('Z.n. Stent 10/25'))] }],
            },
          ],
        },
      ],
    }),
  );
  assert.match(xml, /w:ilvl w:val="0"/);
  assert.match(xml, /w:ilvl w:val="1"/, 'the indented diagnosis sits one level in');
});

test('the Medikation columns keep their tab stops', async () => {
  // What "ASS 100<TAB>1-0-0" has to survive as: his dosing columns hang off
  // real tabs, and a tab turned into spaces collapses the whole block.
  const xml = await documentXml(doc(para(text('ASS 100\t1-0-0'))));
  assert.match(xml, /<w:tab\/>/, 'a real Word tab, not whitespace');
  assert.match(xml, /ASS 100/);
  assert.match(xml, /1-0-0/);
});

test('a line break inside a paragraph stays a line break', async () => {
  const xml = await documentXml(
    doc(para(text('Dres. med. Roth'), { type: 'hardBreak' }, text('Danziger Str. 34'))),
  );
  assert.match(xml, /<w:br\/>/, 'Shift+Enter is not silently welded shut');
  assert.match(xml, /Danziger Str\. 34/);
});

test('bold, italic and underline reach the file', async () => {
  const xml = await documentXml(
    doc(
      para(text('fett', [{ type: 'bold' }])),
      para(text('kursiv', [{ type: 'italic' }])),
      para(text('unterstrichen', [{ type: 'underline' }])),
    ),
  );
  assert.match(xml, /<w:b\b/);
  assert.match(xml, /<w:i\b/);
  assert.match(xml, /<w:u\b/);
});

test('the file is named after the letter, with what Windows forbids removed', () => {
  assert.equal(buildDocx(doc(), 'Bericht 29.08.').fileName, 'Bericht 29.08..docx');
  assert.equal(buildDocx(doc(), 'A/B:C*D?').fileName, 'A-B-C-D-.docx');
  assert.equal(buildDocx(doc(), '   ').fileName, 'Bericht.docx');
});

test('an empty letter still produces a valid file', async () => {
  const xml = await documentXml(doc());
  assert.match(xml, /<w:body>/);
});
