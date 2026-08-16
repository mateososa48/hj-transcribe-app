/**
 * Generates the Word template HJ's letters are rendered into.
 *
 *   npx tsx scripts/make-template.ts
 *
 * WHY GENERATE IT RATHER THAN HAND-EDIT A .docx:
 *
 * docxtemplater substitutes placeholders inside text RUNS. Word is notorious
 * for silently splitting a hand-typed `{titel}` across several runs (spell-check
 * state, a stray autocorrect, tracked-changes residue), and the moment it does,
 * the tag stops matching and the export fails with an unhelpful error. Building
 * the file programmatically guarantees each placeholder is exactly one run.
 *
 * MODELLED ON the two real letters in "HJ report examples/" — specifically the
 * German colleague letter (Type A). Reproduced from those: the recipient block,
 * the "D/" line, the Anrede, "Diagnosen:" with underlined main entries over
 * non-underlined sub-entries, "Zusammenfassende Beurteilung:" as long bullets,
 * "Aktuelle Therapie" as a two-column drug/dosing list, and his closing.
 *
 * The clinic logo header and the GmbH footer are deliberately omitted — those
 * live in his own stationery, and he said to ignore them.
 */
import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  UnderlineType,
} from 'docx';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'templates');
const OUT_FILE = join(OUT_DIR, 'arztbrief-vorlage.docx');

/** His letters are set in a plain serif at ~11pt. */
const FONT = 'Calibri';
const SIZE = 22; // half-points -> 11pt

function text(content: string, opts: { bold?: boolean; underline?: boolean } = {}): TextRun {
  return new TextRun({
    text: content,
    font: FONT,
    size: SIZE,
    ...(opts.bold ? { bold: true } : {}),
    ...(opts.underline ? { underline: { type: UnderlineType.SINGLE } } : {}),
  });
}

function p(children: TextRun[], opts: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({ children, spacing: { after: 120 }, ...opts });
}

/** A plain line of body text. */
function line(content: string, opts: { bold?: boolean; underline?: boolean } = {}): Paragraph {
  return p([text(content, opts)]);
}

function blank(): Paragraph {
  return new Paragraph({ children: [], spacing: { after: 120 } });
}

/** Section heading: bold + underlined, as in "Zusammenfassende Beurteilung:". */
function heading(content: string): Paragraph {
  return new Paragraph({
    children: [text(content, { bold: true, underline: true })],
    spacing: { before: 320, after: 160 },
    heading: HeadingLevel.HEADING_2,
  });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: SIZE } },
    },
  },
  numbering: {
    config: [
      {
        reference: 'hj-bullets',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '▪', // ■ — the square bullet he uses for main entries
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 260 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: '○', // ○ — the hollow circle for sub-entries
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 260 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1400, right: 1100, bottom: 1400, left: 1400 } },
      },
      children: [
        // ---------------------------------------------------------- Kopf ---
        line('Prof. Dr. med. H.-J. Rupprecht - Innere Medizin / Kardiologie'),
        blank(),

        p([text('Mainz, {datum}')], { alignment: AlignmentType.RIGHT }),
        blank(),

        line('An'),
        line('{empfaenger_name}'),
        line('{empfaenger_strasse}'),
        line('{empfaenger_ort}'),
        blank(),
        blank(),

        // His "D/" line: patient name and address on one line.
        line('D/ {patient_anrede} {patient_name}, {patient_adresse}'),
        blank(),

        line('{patient_anrede} {patient_name}, *{patient_geburtsdatum}'),
        line('Tel: {patient_telefon}'),
        blank(),
        blank(),

        // ------------------------------------------------------- Anrede ---
        line('Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege'),
        line(
          'Ich darf nachfolgend über die letzten Untersuchungen, {patient_anrede_akkusativ} {patient_name} betreffend, zusammenfassend berichten',
        ),
        blank(),

        // ---------------------------------------------------- Diagnosen ---
        new Paragraph({
          children: [text('Diagnosen:', { bold: true })],
          spacing: { before: 240, after: 160 },
        }),

        // Loop over diagnoses. The title is underlined and the qualifier is
        // not — which is why they are two placeholders in two runs rather than
        // one. This is exactly the mixed-styling case that would otherwise have
        // needed the paid docxtemplater HTML module.
        p([text('{#diagnosen}')]),
        new Paragraph({
          children: [text('{titel}', { underline: true }), text('{zusatz}')],
          numbering: { reference: 'hj-bullets', level: 0 },
          spacing: { after: 60 },
        }),
        p([text('{#unterpunkte}')]),
        new Paragraph({
          children: [text('{.}')],
          numbering: { reference: 'hj-bullets', level: 1 },
          spacing: { after: 60 },
        }),
        p([text('{/unterpunkte}')]),
        p([text('{/diagnosen}')]),

        // ------------------------------------------- Anamnese (optional) ---
        // Type B (the certificate-style report) has these as their own
        // sections; the colleague letter folds them into the Beurteilung.
        // Left in, wrapped in a conditional so an empty value drops the whole
        // block rather than leaving a stray heading.
        p([text('{#anamnese}')]),
        heading('Anamnese / Vorgeschichte'),
        line('{anamnese_text}'),
        p([text('{/anamnese}')]),

        p([text('{#befunde}')]),
        heading('Befunde'),
        line('{befunde_text}'),
        p([text('{/befunde}')]),

        // -------------------------------------------------- Beurteilung ---
        heading('Zusammenfassende Beurteilung:'),
        p([text('{#beurteilung}')]),
        new Paragraph({
          children: [text('{.}')],
          numbering: { reference: 'hj-bullets', level: 0 },
          spacing: { after: 120 },
        }),
        p([text('{/beurteilung}')]),

        // ------------------------------------------------------ Therapie ---
        heading('Aktuelle Therapie'),
        p([text('{#therapie}')]),
        new Paragraph({
          children: [
            text('{praeparat}'),
            new TextRun({ children: [] }),
            text('\t'),
            text('{dosierung}'),
          ],
          numbering: { reference: 'hj-bullets', level: 0 },
          // Tab stop puts the dosing scheme in its own column, as in his letter.
          tabStops: [{ type: TabStopType.LEFT, position: 3600 }],
          spacing: { after: 40 },
        }),
        p([text('{/therapie}')]),

        // ------------------------------------------------------- Schluss ---
        blank(),
        line('Für Rückfragen stehe ich gerne zur Verfügung und verbleibe'),
        line('mit freundlichen Grüßen'),
        blank(),
        blank(),
        blank(),
        line('Prof. Dr. H.-J. Rupprecht'),
      ],
    },
  ],
});

mkdirSync(OUT_DIR, { recursive: true });
const buffer = await Packer.toBuffer(doc);
writeFileSync(OUT_FILE, buffer);
console.log(`wrote ${OUT_FILE} (${(buffer.length / 1024).toFixed(1)} KB)`);
