import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { LetterDocument } from '@/lib/db.ts';

/**
 * Renders a letter into HJ's Word template.
 *
 * Isomorphic: PizZip and docxtemplater both run in the browser, so the export
 * happens on his machine and the finished .docx never touches a network — which
 * is the whole point of SPEC constraint 1.
 */

/** One entry under "Diagnosen:". */
export interface DiagnoseEntry {
  /** Underlined part, e.g. "Koronare Herzkrankheit mit". */
  titel: string;
  /**
   * Non-underlined remainder on the same line, e.g.
   * ", (4,7 cm, CT 8/25), Aortenklappeninsuffizienz I". Empty string when the
   * whole line is the title.
   */
  zusatz: string;
  /** Sub-entries, rendered with the hollow-circle bullet. */
  unterpunkte: string[];
}

/** One row of "Aktuelle Therapie". */
export interface TherapieEntry {
  /** Drug and strength as he writes it: "ASS 100", "Sevikar 40/5". */
  praeparat: string;
  /** Dosing scheme: "1-0-0", "1-0-0 bis 5/26". */
  dosierung: string;
}

export interface LetterData {
  datum: string;
  empfaenger_name: string;
  empfaenger_strasse: string;
  empfaenger_ort: string;
  patient_anrede: string;
  patient_anrede_akkusativ: string;
  patient_name: string;
  patient_adresse: string;
  patient_geburtsdatum: string;
  patient_telefon: string;
  diagnosen: DiagnoseEntry[];
  beurteilung: string[];
  therapie: TherapieEntry[];
  /** Optional sections — falsy drops the whole block including its heading. */
  anamnese?: boolean;
  anamnese_text?: string;
  befunde?: boolean;
  befunde_text?: string;
}

export class DocxExportError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = 'DocxExportError';
  }
}

/**
 * Split a Beurteilung textarea into the bullet array the template loops over.
 *
 * He writes one bullet per thought, and a bullet can wrap over several lines,
 * so a new bullet starts only at a "- " marker. Continuation lines are folded
 * back into the preceding bullet rather than becoming empty ones.
 */
export function splitBullets(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const bullet = line.match(/^[-•▪*]\s+(.*)$/);
    if (bullet?.[1] !== undefined) {
      out.push(bullet[1].trim());
    } else if (out.length > 0) {
      out[out.length - 1] += ' ' + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Parse the medication section into drug/dosing columns.
 *
 * His format is "<Präparat> <Schema>", where the scheme is the trailing
 * 1-0-0-style token plus any "bis 5/26" qualifier. Anything unparseable is kept
 * whole in the drug column rather than dropped — losing a medication line
 * silently would be far worse than an ugly one.
 */
export function parseTherapie(text: string): TherapieEntry[] {
  const rows: TherapieEntry[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/^[-•▪*]\s+/, '').trim();
    if (!line) continue;
    const match = line.match(/^(.*?)\s+(\d\s*-\s*\d\s*-\s*\d(?:\s*-\s*\d)?.*)$/);
    if (match?.[1] && match[2]) {
      rows.push({ praeparat: match[1].trim(), dosierung: match[2].trim() });
    } else {
      rows.push({ praeparat: line, dosierung: '' });
    }
  }
  return rows;
}

/** Render the template with `data`, returning .docx bytes. */
export function renderLetter(templateBytes: ArrayBuffer | Uint8Array, data: LetterData): Uint8Array {
  let zip: PizZip;
  try {
    zip = new PizZip(templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes));
  } catch (error) {
    throw new DocxExportError(
      'Die Vorlage konnte nicht gelesen werden. Ist es eine gültige .docx-Datei?',
      String(error),
    );
  }

  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // A missing value renders empty rather than throwing — an incomplete
      // letter he can fix by hand beats no letter at all.
      nullGetter: () => '',
    });
    doc.render(data);
    return doc.getZip().generate({ type: 'uint8array' }) as Uint8Array;
  } catch (error) {
    const err = error as { message?: string; properties?: { errors?: Array<{ message?: string }> } };
    const detail =
      err.properties?.errors?.map((e) => e.message).join('; ') ?? err.message ?? String(error);
    throw new DocxExportError('Der Brief konnte nicht erzeugt werden.', detail);
  }
}

/** German date as he writes it in the letterhead: 23.11.2025. */
export function formatGermanDate(d: Date = new Date()): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Build template data from a stored document plus the header fields. */
export function letterDataFromDocument(
  doc: LetterDocument,
  kopf: Partial<LetterData> = {},
): LetterData {
  return {
    datum: formatGermanDate(),
    empfaenger_name: '',
    empfaenger_strasse: '',
    empfaenger_ort: '',
    patient_anrede: 'Herrn',
    patient_anrede_akkusativ: 'Herrn',
    patient_name: '',
    patient_adresse: '',
    patient_geburtsdatum: '',
    patient_telefon: '',
    ...kopf,
    diagnosen: parseDiagnosen(doc.sections.diagnosen),
    beurteilung: splitBullets(doc.sections.beurteilung),
    therapie: parseTherapie(doc.sections.therapie),
    ...(doc.sections.anamnese.trim()
      ? { anamnese: true, anamnese_text: doc.sections.anamnese.trim() }
      : {}),
    ...(doc.sections.befunde.trim()
      ? { befunde: true, befunde_text: doc.sections.befunde.trim() }
      : {}),
  };
}

/**
 * Parse the diagnoses section into title / qualifier / sub-entries.
 *
 * Convention, mirroring his letters: a "- " line is a main diagnosis, and an
 * indented or "  - " line beneath it is a sub-entry. Within a main line, the
 * part before the first comma is the underlined title and the rest is the
 * qualifier — which is how "Aneurysma der Aorta ascendens, (4,7 cm, CT 8/25)"
 * ends up half underlined.
 */
export function parseDiagnosen(text: string): DiagnoseEntry[] {
  const entries: DiagnoseEntry[] = [];
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) continue;
    const indented = /^\s{2,}/.test(rawLine) || /^\s*[o○]\s+/.test(rawLine);
    const content = rawLine.replace(/^\s*[-•▪*o○]\s+/, '').trim();
    if (!content) continue;

    if (indented && entries.length > 0) {
      entries[entries.length - 1]!.unterpunkte.push(content);
      continue;
    }

    const comma = content.indexOf(',');
    entries.push(
      comma === -1
        ? { titel: content, zusatz: '', unterpunkte: [] }
        : { titel: content.slice(0, comma), zusatz: content.slice(comma), unterpunkte: [] },
    );
  }
  return entries;
}
