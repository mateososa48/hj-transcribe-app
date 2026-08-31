import {
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  TextRun,
} from 'docx';

/**
 * Bericht -> .docx. Maps the editor's JSON to real Word structures —
 * headings as heading styles, lists as list numbering, tabs as actual tab
 * characters (so the Medikation columns land on tab stops, not as spaces).
 * Scope is exactly what the toolbar can produce: headings 1-3, bold/italic/
 * underline, font sizes, bullet and numbered lists one level deep.
 */

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
] as const;

/** rem strings from the Schriftgröße select -> Word half-points. */
function fontSizeToHalfPoints(value: unknown): number | undefined {
  if (value === '1.25rem') return 28; // 14 pt
  if (value === '1.5rem') return 32; // 16 pt
  return undefined;
}

function runsOf(node: TiptapNode): TextRun[] {
  const runs: TextRun[] = [];
  for (const child of node.content ?? []) {
    if (child.type !== 'text' || !child.text) continue;
    const marks = child.marks ?? [];
    const bold = marks.some((m) => m.type === 'bold');
    const italics = marks.some((m) => m.type === 'italic');
    const underline = marks.some((m) => m.type === 'underline');
    const size = fontSizeToHalfPoints(
      marks.find((m) => m.type === 'textStyle')?.attrs?.fontSize,
    );
    // Literal tabs become real Word tabs, not spaces.
    const parts = child.text.split('\t');
    const children = parts.flatMap((part, i) => (i > 0 ? [new Tab(), part] : [part]));
    runs.push(
      new TextRun({
        children,
        bold,
        italics,
        ...(underline ? { underline: {} } : {}),
        ...(size ? { size } : {}),
      }),
    );
  }
  return runs;
}

export async function exportDocx(json: unknown, title: string): Promise<void> {
  const doc = json as TiptapNode;
  const paragraphs: Paragraph[] = [];
  let orderedInstance = 0;

  const walkList = (list: TiptapNode, ordered: boolean, level: number, instance: number) => {
    for (const item of list.content ?? []) {
      for (const block of item.content ?? []) {
        if (block.type === 'paragraph') {
          paragraphs.push(
            new Paragraph({
              children: runsOf(block),
              ...(ordered
                ? { numbering: { reference: 'bericht-num', level, instance } }
                : { bullet: { level } }),
            }),
          );
        } else if (block.type === 'bulletList' || block.type === 'orderedList') {
          walkList(block, block.type === 'orderedList', Math.min(level + 1, 2), instance);
        }
      }
    }
  };

  for (const node of doc.content ?? []) {
    if (node.type === 'heading') {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 3) as 1 | 2 | 3;
      const heading = HEADING_LEVELS[level - 1] ?? HeadingLevel.HEADING_2;
      paragraphs.push(new Paragraph({ children: runsOf(node), heading }));
    } else if (node.type === 'bulletList') {
      walkList(node, false, 0, 0);
    } else if (node.type === 'orderedList') {
      orderedInstance += 1;
      walkList(node, true, 0, orderedInstance);
    } else if (node.type === 'paragraph') {
      paragraphs.push(new Paragraph({ children: runsOf(node) }));
    }
  }

  const file = new Document({
    // Word's built-in heading styles are light blue — his letters are black,
    // bold, Calibri. Define the look explicitly so the export IS the letter.
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: '000000' } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Calibri', size: 28, bold: true, color: '000000' },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          // His own section headings: body size, bold, underlined. Word must
          // match the screen, and the screen matches his letters.
          run: { font: 'Calibri', size: 22, bold: true, underline: {}, color: '000000' },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Calibri', size: 22, bold: true, color: '000000' },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bericht-num',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(file);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Bericht'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
